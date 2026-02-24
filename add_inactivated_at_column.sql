-- SQL para adicionar a coluna de data de inativação
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS inactivated_at TIMESTAMPTZ;

-- Comentário para documentação
COMMENT ON COLUMN public.addresses.inactivated_at IS 'Data em que o endereço foi desativado (ex: marcado como Não Visitar)';
