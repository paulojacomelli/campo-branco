
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Cliente Supabase para uso no navegador (Client Components)
// Gerencia automaticamente a persistência da sessão via cookies para compatibilidade com SSR/API
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
