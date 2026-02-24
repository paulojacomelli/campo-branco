-- ##########################################################
-- CORREÇÕES PARA LINTER SUPABASE (SEARCH PATH E RLS)
-- Cole este script no SQL Editor do Supabase e execute.
-- ##########################################################

-- 1. CORREÇÃO DE SEARCH_PATH MUTÁVEL NAS FUNÇÕES
-- Para as funções get_my_role e get_my_congregation_id, que parecem ser funções antigas ou customizadas
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_role') THEN
        ALTER FUNCTION public.get_my_role() SET search_path = public;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_congregation_id') THEN
        ALTER FUNCTION public.get_my_congregation_id() SET search_path = public;
    END IF;
END $$;

-- Atualiza a função update_updated_at_column para não ter search_path mutável
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Garante que as funções atuais de auth também tenham search_path setados (caso falte)
ALTER FUNCTION public.get_auth_role() SET search_path = public;
ALTER FUNCTION public.get_auth_congregation() SET search_path = public;


-- 2. CORREÇÃO DE POLÍTICA RLS PERMISSIVA PARA SHARED_LIST_SNAPSHOTS
-- Esta política permitia 'INSERT' com 'WITH CHECK (true)', substituímos para verificar autorização real
DROP POLICY IF EXISTS "Permitir inserção de snapshots por usuários autenticados" ON public.shared_list_snapshots;
DROP POLICY IF EXISTS "Permitir inserção de snapshots" ON public.shared_list_snapshots;
CREATE POLICY "Permitir inserção de snapshots" ON public.shared_list_snapshots 
FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shared_lists sl 
        WHERE sl.id = shared_list_id 
        AND sl.congregation_id = (select public.get_auth_congregation())
    )
    OR (select public.get_auth_role()) = 'SUPER_ADMIN'
);


-- 3. CORREÇÃO TAREFA DE WITNESSING POINTS (UPDATE EXTREMAMENTE PERMISSIVO)
DROP POLICY IF EXISTS "Qualquer um pode fazer check-in/out (via updates controlados)" ON public.witnessing_points;
DROP POLICY IF EXISTS "Atualizar pontos de testemunho" ON public.witnessing_points;
CREATE POLICY "Atualizar pontos de testemunho" ON public.witnessing_points 
FOR UPDATE TO authenticated 
USING (
    congregation_id = (select public.get_auth_congregation()) OR
    (select public.get_auth_role()) = 'SUPER_ADMIN'
);


-- 4. ADIÇÃO DE POLÍTICAS DE RLS AUSENTES PARA SHARED_LISTS
DROP POLICY IF EXISTS "Ver listas compartilhadas" ON public.shared_lists;
CREATE POLICY "Ver listas compartilhadas" ON public.shared_lists FOR SELECT TO authenticated USING (
    congregation_id = (select public.get_auth_congregation()) OR (select public.get_auth_role()) = 'SUPER_ADMIN'
);

DROP POLICY IF EXISTS "Gerenciar listas compartilhadas" ON public.shared_lists;
CREATE POLICY "Gerenciar listas compartilhadas" ON public.shared_lists FOR ALL TO authenticated USING (
    (congregation_id = (select public.get_auth_congregation()) AND (select public.get_auth_role()) IN ('ADMIN', 'ANCIAO', 'SERVO')) OR
    (select public.get_auth_role()) = 'SUPER_ADMIN'
);

-- 5. OTIMIZAÇÃO DE PERFORMANCE (LINTER RLS) NAS PRÓPRIAS FUNÇÕES DE AUTH
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role AS $$
BEGIN
    RETURN (SELECT role FROM public.users WHERE id = (select auth.uid()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_congregation()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT congregation_id FROM public.users WHERE id = (select auth.uid()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. OTIMIZAÇÃO DE PERFORMANCE DE LINTER EM POLÍTICAS QUE USAVAM AUTH.UID() E FUNÇÕES CONTINUAMENTE
-- Recriando políticas da tabela Addresses e Territories que usavam chamadas repetitivas de forma defasada.
DROP POLICY IF EXISTS "Ver endereços (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.addresses;
CREATE POLICY "Ver endereços (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.addresses FOR SELECT TO authenticated USING (
    (select public.get_auth_role()) IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = (select public.get_auth_congregation()) OR (select public.get_auth_role()) = 'SUPER_ADMIN')
    OR
    territory_id IN (SELECT id FROM public.territories WHERE assigned_to = (select auth.uid()))
);

DROP POLICY IF EXISTS "Gerenciar endereços (Ancião/Servo/Superadmin)" ON public.addresses;
CREATE POLICY "Gerenciar endereços (Ancião/Servo/Superadmin)" ON public.addresses FOR ALL TO authenticated USING (
    ((congregation_id = (select public.get_auth_congregation()) AND
     (select public.get_auth_role()) IN ('ADMIN', 'ANCIAO', 'SERVO'))) OR
    (select public.get_auth_role()) = 'SUPER_ADMIN'
);
