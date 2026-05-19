// ============================================================
// CIRO Mobile — Supabase Client configuration
// Configured with persistent AsyncStorage for session state
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Pre-loaded directly from active project configurations
const SUPABASE_URL = 'https://gbschepxsnjiygrdmhnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2NoZXB4c25qaXlncmRtaG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTg3MDIsImV4cCI6MjA5NDQ5NDcwMn0.E8NTXivtR9w6oAF9WGbySrchquhoGsAAAPkDFIdDQYU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Checks if Supabase client is configured and responding
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('ciro_crises').select('id').limit(1);
    if (error) {
      console.warn('[Supabase Mobile] Connection check returned error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Supabase Mobile] Failed to query databases:', e);
    return false;
  }
}
