
import { createContext, useContext, ReactNode, useEffect, useState, useRef } from 'react';
import { Teacher, Permission, Replacement } from '../types';
import { useTeachers } from '../hooks/useTeachers';
import { useReplacements } from '../hooks/useReplacements';
import { useDataManagement } from '../hooks/useDataManagement';
import { useAuth } from './AuthContext';
import { supabase } from '../integrations/supabase/client';

interface DataContextType {
  teachers: Teacher[];
  setTeachers: (teachers: Teacher[]) => void;
  addTeacher: (teacher: Teacher) => void;
  updateTeacher: (teacher: Teacher) => void;
  deleteTeacher: (id: string) => void;
  addPermission: (teacherId: string, permission: Permission) => void;
  updatePermission: (teacherId: string, permission: Permission) => void;
  deletePermission: (teacherId: string, permissionId: string) => void;
  clearAllData: () => void;
  exportData: () => string;
  importData: (data: string) => boolean;
  replacements: Replacement[];
  addReplacement: (replacement: Replacement) => void;
  deleteReplacement: (id: string) => void;
  getReplacementsByDate: (date: string) => Replacement[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { currentUser, authLoading } = useAuth();
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const skipNextCloudSave = useRef(false);
  const {
    teachers,
    setTeachers,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    addPermission,
    updatePermission,
    deletePermission
  } = useTeachers();

  const {
    replacements,
    setReplacements,
    addReplacement,
    deleteReplacement,
    getReplacementsByDate
  } = useReplacements();

  const {
    clearAllData,
    exportData: exportDataFn,
    importData: importDataFn
  } = useDataManagement(setTeachers, setReplacements);

  // Eliminando una sostituzione di recupero permesso, ripristina il permesso originale.
  const deleteReplacementWithPermissionRestore = (id: string) => {
    const replacement = replacements.find(r => r.id === id);
    if (replacement?.permissionId && replacement.replacementTeacherId) {
      const owner = teachers.find(t => t.id === replacement.replacementTeacherId);
      const permission = owner?.permissions.find(p => p.id === replacement.permissionId);
      if (owner && permission) {
        updatePermission(owner.id, { ...permission, recovered: false, recoveryDate: undefined });
      }
    }
    deleteReplacement(id);
  };

  // Carica lo stato condiviso dopo l'autenticazione. Il localStorage resta una cache
  // locale e viene usato per inizializzare il database solo se questo è ancora vuoto.
  useEffect(() => {
    let cancelled = false;
    const loadCloudData = async () => {
      if (authLoading) return;
      if (!currentUser) {
        setCloudUserId(null);
        setCloudStatus('loading');
        return;
      }
      setCloudStatus('loading');
      const { data, error } = await supabase
        .from('app_state')
        .select('data')
        .eq('id', 1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Impossibile leggere i dati online:', error.message);
        setCloudStatus('error');
        return;
      }
      if (data?.data && typeof data.data === 'object') {
        const cloudData = data.data as { teachers?: Teacher[]; replacements?: Replacement[] };
        if (Array.isArray(cloudData.teachers)) setTeachers(cloudData.teachers);
        if (Array.isArray(cloudData.replacements)) setReplacements(cloudData.replacements);
      } else {
        const initialData = { teachers, replacements };
        const { error: saveError } = await supabase.from('app_state').upsert({
          id: 1, data: initialData as any, updated_by: currentUser.id, updated_at: new Date().toISOString()
        });
        if (saveError) {
          console.error('Inizializzazione database non riuscita:', saveError.message);
          setCloudStatus('error');
          return;
        }
      }
      if (!cancelled) {
        setCloudUserId(currentUser.id);
        setCloudStatus('ready');
      }
    };
    void loadCloudData();
    return () => { cancelled = true; };
    // Il caricamento deve avvenire solo al cambio sessione, non a ogni modifica dei dati.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, authLoading]);

  // Salvataggio automatico online di docenti, orari, permessi e sostituzioni.
  useEffect(() => {
    if (!currentUser || cloudStatus !== 'ready' || cloudUserId !== currentUser.id) return;
    if (skipNextCloudSave.current) { skipNextCloudSave.current = false; return; }
    const timer = window.setTimeout(async () => {
      const { error } = await supabase.from('app_state').upsert({
        id: 1,
        data: { teachers, replacements } as any,
        updated_by: currentUser.id,
        updated_at: new Date().toISOString(),
      });
      if (error) console.error('Errore salvataggio online:', error.message);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [teachers, replacements, currentUser, cloudStatus, cloudUserId]);

  // Aggiorna gli altri dispositivi quando un utente salva nuove modifiche.
  useEffect(() => {
    if (!currentUser || cloudStatus !== 'ready') return;
    const channel = supabase.channel('app-state-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'id=eq.1' }, (payload) => {
        if (payload.new.updated_by === currentUser.id) return;
        const cloudData = payload.new.data as { teachers?: Teacher[]; replacements?: Replacement[] };
        skipNextCloudSave.current = true;
        if (Array.isArray(cloudData.teachers)) setTeachers(cloudData.teachers);
        if (Array.isArray(cloudData.replacements)) setReplacements(cloudData.replacements);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUser, cloudStatus, setTeachers, setReplacements]);

  const exportData = () => exportDataFn(teachers, replacements);
  const importData = (data: string) => importDataFn(data);

  return (
    <DataContext.Provider
      value={{
        teachers,
        setTeachers,
        addTeacher,
        updateTeacher,
        deleteTeacher,
        addPermission,
        updatePermission,
        deletePermission,
        clearAllData,
        exportData,
        importData,
        replacements,
        addReplacement,
        deleteReplacement: deleteReplacementWithPermissionRestore,
        getReplacementsByDate
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
