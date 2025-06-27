import { createClient } from '@supabase/supabase-js';

// Valores fixos para desenvolvimento, caso as variáveis de ambiente não estejam disponíveis


// Tentar obter das variáveis de ambiente primeiro
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variáveis de ambiente do Supabase não encontradas, usando valores padrão');
}

// Remover espaços ou quebras de linha que possam estar nas variáveis de ambiente
const cleanUrl = supabaseUrl.trim();
const cleanKey = supabaseAnonKey.trim();

console.log('Inicializando Supabase com URL:', cleanUrl);

export const supabase = createClient(cleanUrl, cleanKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'musicsheet-auth-token',
    flowType: 'pkce',
    debug: true
  }
});
