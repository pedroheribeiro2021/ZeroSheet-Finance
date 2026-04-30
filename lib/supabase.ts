import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !/^https?:\/\//.test(supabaseUrl)) {
  throw new Error(
    'Invalid NEXT_PUBLIC_SUPABASE_URL. Expected a full HTTP/HTTPS URL, e.g. https://<project-ref>.supabase.co'
  );
}

if (!supabaseAnonKey || supabaseAnonKey === 'COLE_AQUI') {
  throw new Error(
    'Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY. Set your real Supabase anon/public key in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
