import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// I valori pubblici del progetto possono essere sovrascritti tramite .env.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://efxxezmnagiqgvzvonux.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lQKtyXedPaN3rwy541Lr8g_dySYy2kN';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
