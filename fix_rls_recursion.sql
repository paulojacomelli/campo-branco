-- ##########################################################
-- CAMPO BRANCO - CORREÇÃO DE RECURSÃO RLS (VERSÃO COMPLETA)
-- Objetivo: Restaurar TODAS as políticas após DROP CASCADE
-- ##########################################################

-- 1. FUNÇÕES DE AUXÍLIO (SECURITY DEFINER ignora RLS e evita loops)
DROP FUNCTION IF EXISTS public.get_auth_role() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role AS $$
BEGIN
    RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.get_auth_congregation() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_congregation()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT congregation_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. POLÍTICAS PARA 'USERS'
DROP POLICY IF EXISTS "Usuário vê seu próprio perfil" ON public.users;
CREATE POLICY "Usuário vê seu próprio perfil" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "SuperAdmins veem todos os usuários" ON public.users;
CREATE POLICY "SuperAdmins veem todos os usuários" ON public.users FOR SELECT TO authenticated USING (
    get_auth_role() = 'SUPER_ADMIN'
);

DROP POLICY IF EXISTS "Anciãos e Servos veem usuários da congregação" ON public.users;
CREATE POLICY "Anciãos e Servos veem usuários da congregação" ON public.users FOR SELECT TO authenticated USING (
    congregation_id = get_auth_congregation() AND
    get_auth_role() IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO')
);

-- 3. POLÍTICAS PARA 'VISITS'
DROP POLICY IF EXISTS "Ver visitas (Superadmin/Ancião/Servo vêm tudo, Publicador vê suas próprias)" ON public.visits;
CREATE POLICY "Ver visitas (Superadmin/Ancião/Servo vêm tudo, Publicador vê suas próprias)" ON public.visits FOR SELECT TO authenticated USING (
    get_auth_role() IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = get_auth_congregation() OR get_auth_role() = 'SUPER_ADMIN')
    OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Inserir visitas (Todos authenticated)" ON public.visits;
CREATE POLICY "Inserir visitas (Todos authenticated)" ON public.visits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 4. POLÍTICAS PARA 'CITIES'
DROP POLICY IF EXISTS "SuperAdmins conseguem tudo em cidades" ON public.cities;
CREATE POLICY "SuperAdmins conseguem tudo em cidades" ON public.cities FOR ALL TO authenticated USING (get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "Qualquer autenticado lê cidades" ON public.cities;
CREATE POLICY "Qualquer autenticado lê cidades" ON public.cities FOR SELECT TO authenticated USING (true);

-- 5. POLÍTICAS PARA 'CONGREGATIONS'
DROP POLICY IF EXISTS "SuperAdmins conseguem tudo em congregações" ON public.congregations;
CREATE POLICY "SuperAdmins conseguem tudo em congregações" ON public.congregations FOR ALL TO authenticated USING (get_auth_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "Membros leem sua própria congregação" ON public.congregations;
CREATE POLICY "Membros leem sua própria congregação" ON public.congregations FOR SELECT TO authenticated USING (id = get_auth_congregation());

-- 6. POLÍTICAS PARA 'TERRITORIES'
DROP POLICY IF EXISTS "Ver territórios (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.territories;
CREATE POLICY "Ver territórios (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.territories FOR SELECT TO authenticated USING (
    get_auth_role() IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = get_auth_congregation() OR get_auth_role() = 'SUPER_ADMIN')
    OR assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Gerenciar territórios (Ancião/Servo/Superadmin)" ON public.territories;
CREATE POLICY "Gerenciar territórios (Ancião/Servo/Superadmin)" ON public.territories FOR ALL TO authenticated USING (
    ((congregation_id = get_auth_congregation() AND get_auth_role() IN ('ADMIN', 'ANCIAO', 'SERVO'))) OR get_auth_role() = 'SUPER_ADMIN'
);

-- 7. POLÍTICAS PARA 'ADDRESSES'
DROP POLICY IF EXISTS "Ver endereços (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.addresses;
CREATE POLICY "Ver endereços (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.addresses FOR SELECT TO authenticated USING (
    get_auth_role() IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = get_auth_congregation() OR get_auth_role() = 'SUPER_ADMIN')
    OR territory_id IN (SELECT id FROM public.territories WHERE assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "Gerenciar endereços (Ancião/Servo/Superadmin)" ON public.addresses;
CREATE POLICY "Gerenciar endereços (Ancião/Servo/Superadmin)" ON public.addresses FOR ALL TO authenticated USING (
    ((congregation_id = get_auth_congregation() AND get_auth_role() IN ('ADMIN', 'ANCIAO', 'SERVO'))) OR get_auth_role() = 'SUPER_ADMIN'
);

-- 8. POLÍTICAS PARA 'WITNESSING_POINTS'
DROP POLICY IF EXISTS "Ver pontos de testemunho" ON public.witnessing_points;
CREATE POLICY "Ver pontos de testemunho" ON public.witnessing_points FOR SELECT TO authenticated USING (
    congregation_id = get_auth_congregation() OR get_auth_role() = 'SUPER_ADMIN'
);

DROP POLICY IF EXISTS "Admin total em pontos" ON public.witnessing_points;
CREATE POLICY "Admin total em pontos" ON public.witnessing_points FOR ALL TO authenticated USING (
    (congregation_id = get_auth_congregation() AND get_auth_role() IN ('ADMIN', 'ANCIAO', 'SERVO')) OR get_auth_role() = 'SUPER_ADMIN'
);

-- 9. POLÍTICAS PARA 'BUG_REPORTS'
DROP POLICY IF EXISTS "SuperAdmins gerenciam tudo em bugs" ON public.bug_reports;
CREATE POLICY "SuperAdmins gerenciam tudo em bugs" ON public.bug_reports FOR ALL TO authenticated USING (get_auth_role() = 'SUPER_ADMIN');

-- Reiniciar cache do PostgREST
NOTIFY pgrst, 'reload schema';
