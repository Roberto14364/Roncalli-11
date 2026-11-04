import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  authLoading: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function mapUser(session: Session | null): Promise<User | null> {
  if (!session?.user) return null;
  const authUser = session.user;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authUser.id).maybeSingle();
  return { id: authUser.id, username: authUser.email || '', password: '', role: profile?.role === 'admin' ? 'admin' : 'collaborator' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) console.error('Errore recupero sessione Supabase:', error.message);
      const mapped = await mapUser(data.session);
      if (mounted) { setCurrentUser(mapped); setAuthLoading(false); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void mapUser(session).then((mapped) => { setCurrentUser(mapped); setAuthLoading(false); }); }, 0);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { console.error('Login Supabase:', error.message); return false; }
    return true;
  };

  const logout = async () => { await supabase.auth.signOut(); setCurrentUser(null); };

  return <AuthContext.Provider value={{ currentUser, login, logout, isAuthenticated: !!currentUser, authLoading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
