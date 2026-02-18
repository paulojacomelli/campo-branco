
-- 1. Habilitar DELETE para Super Admin em congregations
-- Correção: Verificar tanto 'super_admin' quanto 'SUPER_ADMIN' para evitar case-sensitivity issues
DROP POLICY IF EXISTS "Enable delete for super admins" ON "public"."congregations";
CREATE POLICY "Enable delete for super admins" ON "public"."congregations"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (users.role = 'super_admin' OR users.role = 'SUPER_ADMIN')
  )
);

-- 2. Garantir que as tabelas filhas tenham ON DELETE CASCADE (ou SET NULL)

-- Territories -> Devem sumir com a congregação? Sim.
ALTER TABLE territories DROP CONSTRAINT IF EXISTS territories_congregation_id_fkey;
ALTER TABLE territories
    ADD CONSTRAINT territories_congregation_id_fkey
    FOREIGN KEY (congregation_id)
    REFERENCES congregations(id)
    ON DELETE CASCADE;

-- Cities -> Devem sumir? Sim.
ALTER TABLE cities DROP CONSTRAINT IF EXISTS cities_congregation_id_fkey;
ALTER TABLE cities
    ADD CONSTRAINT cities_congregation_id_fkey
    FOREIGN KEY (congregation_id)
    REFERENCES congregations(id)
    ON DELETE CASCADE;

-- Users -> NÃO DEVEM sumir, apenas desvincular.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_congregation_id_fkey;
ALTER TABLE users
    ADD CONSTRAINT users_congregation_id_fkey
    FOREIGN KEY (congregation_id)
    REFERENCES congregations(id)
    ON DELETE SET NULL;
