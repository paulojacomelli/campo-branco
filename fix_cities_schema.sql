-- ##########################################################
-- CAMPO BRANCO - AJUSTE DE SCHEMA CITIES (HOTFIX)
-- Objetivo: Sincronizar colunas faltantes na tabela cities
-- ##########################################################

-- 1. ADICIONAR COLUNAS FALTANTES NA TABELA 'cities'
ALTER TABLE public.cities 
ADD COLUMN IF NOT EXISTS uf TEXT,
ADD COLUMN IF NOT EXISTS congregation_id TEXT REFERENCES public.congregations(id),
ADD COLUMN IF NOT EXISTS parent_city TEXT,
ADD COLUMN IF NOT EXISTS lat DECIMAL,
ADD COLUMN IF NOT EXISTS lng DECIMAL;

-- 2. NOTA TÉCNICA
-- Isso resolve o erro "Could not find the 'congregation_id' column of 'cities'".
-- Após executar, o cache do Supabase será atualizado automaticamente.
