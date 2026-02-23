-- ##########################################################
-- CAMPO BRANCO - LIMPEZA PROFUNDA DE ENDEREÇOS (FINAL v2)
-- Objetivo: Remover colunas redundantes e adicionar residents_count
-- ##########################################################

-- 1. REMOVER COLUNAS REDUNDANTES/LEGADAS NA TABELA 'addresses'
-- Usa IF EXISTS para não falhar se a coluna já foi removida anteriormente
ALTER TABLE public.addresses 
DROP COLUMN IF EXISTS number,
DROP COLUMN IF EXISTS complement,
DROP COLUMN IF EXISTS block,
DROP COLUMN IF EXISTS neighborhood,
DROP COLUMN IF EXISTS coordinates,
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS last_visit,
DROP COLUMN IF EXISTS phone;

-- 2. ADICIONAR COLUNA 'residents_count' COM NOME SEMÂNTICO CORRETO
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS residents_count INTEGER DEFAULT 1;

-- 3. GARANTIR COLUNAS DE STATUS USADAS PELA UI E TRIGGER DE AUDITORIA
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS visit_status TEXT DEFAULT 'PENDENTE',
ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. NOTA TÉCNICA
-- O campo 'phone' era usado como 'people_count' (gambiarra).
-- Agora temos 'residents_count' com nome e tipo corretos.
-- Após executar, o cache do Supabase será atualizado automaticamente.
