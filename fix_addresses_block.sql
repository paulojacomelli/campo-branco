-- ##########################################################
-- CAMPO BRANCO - AJUSTE DE SCHEMA ADDRESSES (HOTFIX - BLOCK)
-- Objetivo: Sincronizar a coluna 'block' faltante
-- ##########################################################

-- 1. ADICIONAR COLUNA 'block' NA TABELA 'addresses'
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS block TEXT;

-- 2. NOTA TÉCNICA
-- Isso resolve o erro "Could not find the 'block' column of 'addresses'".
-- O campo 'block' é usado para Bloco/Apartamento em endereços.
-- Após executar, o cache do Supabase será atualizado automaticamente.
