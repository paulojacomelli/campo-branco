-- PATCH DE OTIMIZAÇÃO (Prioridade: MÁXIMA)
-- Executar este SQL no Editor de SQL do Supabase.
-- Ele resolve o problema de Carregamento Lento mudando as permissões RLS pesadas
-- para consultas em cache (STABLE + LANGUAGE sql).

-- 1. Otimiza get_auth_role()
DROP FUNCTION IF EXISTS public.get_auth_role() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role AS $$
    SELECT role::user_role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Otimiza get_auth_congregation()
DROP FUNCTION IF EXISTS public.get_auth_congregation() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_congregation()
RETURNS TEXT AS $$
    SELECT congregation_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
