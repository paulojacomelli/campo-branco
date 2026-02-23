-- ##########################################################
-- CAMPO BRANCO - AJUSTE DE SCHEMA TERRITORIES (HOTFIX)
-- Objetivo: Sincronizar colunas faltantes na tabela territories
-- ##########################################################

-- 1. ADICIONAR COLUNAS FALTANTES NA TABELA 'territories'
ALTER TABLE public.territories 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS lat DECIMAL,
ADD COLUMN IF NOT EXISTS lng DECIMAL;

-- 2. NOTA TÉCNICA
-- Isso resolve o erro "Could not find the 'description' column of 'territories'".
-- O código foi atualizado para usar 'notes' em vez de 'description' para manter o padrão.
-- Após executar, o cache do Supabase será atualizado automaticamente.
