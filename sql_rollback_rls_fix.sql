-- ##########################################################
-- SCRIPT DE REVERSÃO - PERFORMANCE RLS
-- Cole este script no SQL Editor para restaurar as funções de Auth e as políticas ao estado que funcionava no seu Dashboard.
-- ##########################################################

-- 1. Restaurar Funções de Auth Base
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role AS $$
BEGIN
    RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_congregation()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT congregation_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. Restaurar Endereços (Tirar os selects sub-queries de validação de perfomance)
DROP POLICY IF EXISTS "Ver endereços (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.addresses;
CREATE POLICY "Ver endereços (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.addresses FOR SELECT TO authenticated USING (
    public.get_auth_role() IN ('ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = public.get_auth_congregation() OR public.get_auth_role() = 'ADMIN')
    OR
    territory_id IN (SELECT id FROM public.territories WHERE assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "Gerenciar endereços (Ancião/Servo/Superadmin)" ON public.addresses;
CREATE POLICY "Gerenciar endereços (Ancião/Servo/Superadmin)" ON public.addresses FOR ALL TO authenticated USING (
    (congregation_id = public.get_auth_congregation() AND
     public.get_auth_role() IN ('ADMIN', 'ANCIAO', 'SERVO')) OR
    public.get_auth_role() = 'ADMIN'
);

-- 3. Restaurar Shared Lists
DROP POLICY IF EXISTS "Ver listas compartilhadas" ON public.shared_lists;
CREATE POLICY "Ver listas compartilhadas" ON public.shared_lists FOR SELECT TO authenticated USING (
    congregation_id = public.get_auth_congregation() OR public.get_auth_role() = 'ADMIN'
);

DROP POLICY IF EXISTS "Gerenciar listas compartilhadas" ON public.shared_lists;
CREATE POLICY "Gerenciar listas compartilhadas" ON public.shared_lists FOR ALL TO authenticated USING (
    (congregation_id = public.get_auth_congregation() AND public.get_auth_role() IN ('ADMIN', 'ANCIAO', 'SERVO')) OR
    public.get_auth_role() = 'ADMIN'
);

-- 4. Restaurar Witnessing Points
DROP POLICY IF EXISTS "Atualizar pontos de testemunho" ON public.witnessing_points;
CREATE POLICY "Atualizar pontos de testemunho" ON public.witnessing_points 
FOR UPDATE TO authenticated 
USING (
    congregation_id = public.get_auth_congregation() OR
    public.get_auth_role() = 'ADMIN'
);

-- 5. Restaurar Snapshots
DROP POLICY IF EXISTS "Permitir inserção de snapshots" ON public.shared_list_snapshots;
CREATE POLICY "Permitir inserção de snapshots" ON public.shared_list_snapshots 
FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shared_lists sl 
        WHERE sl.id = shared_list_id 
        AND sl.congregation_id = public.get_auth_congregation()
    )
    OR public.get_auth_role() = 'ADMIN'
);
