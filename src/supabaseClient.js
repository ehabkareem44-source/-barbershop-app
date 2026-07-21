import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in dev/build if env vars are missing, instead of a confusing
  // runtime error deep inside supabase-js.
  console.error(
    'Supabase env vars missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file (see .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
