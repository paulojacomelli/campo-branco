-- ##########################################################
-- CAMPO BRANCO - AJUSTE DE SCHEMA (HOTFIX)
-- Versão: 0.4.279-beta
-- Objetivo: Sincronizar colunas faltantes após migração
-- ##########################################################

-- 1. AJUSTES NA TABELA 'addresses' (Endereços)
-- Adiciona colunas que o código espera mas não estão no banco
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS complement TEXT,
ADD COLUMN IF NOT EXISTS lat DECIMAL,
ADD COLUMN IF NOT EXISTS lng DECIMAL,
ADD COLUMN IF NOT EXISTS google_maps_link TEXT,
ADD COLUMN IF NOT EXISTS waze_link TEXT,
ADD COLUMN IF NOT EXISTS resident_name TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_deaf BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_student BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_neurodivergent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS observations TEXT,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. AJUSTES NA TABELA 'territories' (Territórios)
-- Adiciona coluna de notas que estava faltando
ALTER TABLE public.territories 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. NOTA TÉCNICA
-- Após executar este script, o Supabase atualizará o cache do PostgREST.
-- Se o erro persistir por mais de 30 segundos, tente atualizar o painel do Supabase.
