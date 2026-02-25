-- PATCH: Sincronização da tabela witnessing_points
-- Executar este SQL no Editor de SQL do Supabase para adicionar as colunas faltantes.

ALTER TABLE public.witnessing_points 
ADD COLUMN IF NOT EXISTS schedule TEXT,
ADD COLUMN IF NOT EXISTS google_maps_link TEXT,
ADD COLUMN IF NOT EXISTS waze_link TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.witnessing_points.schedule IS 'Horários de funcionamento ou escalas do ponto';
COMMENT ON COLUMN public.witnessing_points.google_maps_link IS 'Link direto para o Google Maps';
COMMENT ON COLUMN public.witnessing_points.waze_link IS 'Link direto para o Waze';
