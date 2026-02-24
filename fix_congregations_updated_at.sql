-- ##########################################################
-- CAMPO BRANCO - AJUSTE DE SCHEMA CONGREGATIONS (HOTFIX)
-- Objetivo: Sincronizar colunas faltantes na tabela congregations
-- ##########################################################

-- 1. ADICIONAR COLUNAS FALTANTES NA TABELA 'congregations'
ALTER TABLE public.congregations 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. GARANTIR QUE O TRIGGER EXISTE E ESTÁ FUNCIONANDO
-- A função update_updated_at_column() já deve existir (usada em outras tabelas)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_congregations_updated_at') THEN
        CREATE TRIGGER update_congregations_updated_at 
        BEFORE UPDATE ON public.congregations 
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- 3. NOTA TÉCNICA
-- Isso resolve o erro "record 'new' has no field 'updated_at'".
-- Após executar no SQL Editor do Supabase, o erro deve desaparecer imediatamente.
