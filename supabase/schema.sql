-- ##########################################################
-- CAMPO BRANCO - SCHEMA COMPLETO (SUPABASE)
-- Versão: 0.4.225
-- Data: 20/02/2026
-- ##########################################################

-- ##########################################################
-- 1. EXTENSÕES E CONFIGURAÇÕES
-- ##########################################################
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ##########################################################
-- 2. TIPOS CUSTOMIZADOS (ENUMS)
-- ##########################################################

-- Papéis de Usuário
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'ADMIN', 
        'ANCIAO', 
        'SERVO', 
        'PUBLICADOR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipos de Congregação
DO $$ BEGIN
    CREATE TYPE congregation_type AS ENUM (
        'TRADITIONAL', 
        'SIGN_LANGUAGE', 
        'FOREIGN_LANGUAGE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status de Território/Ponto
DO $$ BEGIN
    CREATE TYPE point_status AS ENUM (
        'AVAILABLE', 
        'OCCUPIED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ##########################################################
-- 3. TABELAS PRINCIPAIS
-- ##########################################################

-- CIDADES
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    uf TEXT,
    congregation_id TEXT REFERENCES public.congregations(id),
    parent_city TEXT,
    lat DECIMAL,
    lng DECIMAL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- CONGREGAÇÕES
CREATE TABLE IF NOT EXISTS public.congregations (
    id TEXT PRIMARY KEY, -- ID personalizado ou UUID em formato texto
    name TEXT NOT NULL,
    number TEXT,
    city TEXT,          -- Cidade como texto direto (simplificado)
    category TEXT,       -- Categoria (SIGN_LANGUAGE, etc)
    term_type TEXT DEFAULT 'city', -- city ou neighborhood
    city_id UUID REFERENCES public.cities(id),
    type congregation_type DEFAULT 'TRADITIONAL',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- USUÁRIOS (Perfil estendido do Auth)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role DEFAULT 'PUBLICADOR',
    congregation_id TEXT REFERENCES public.congregations(id),
    terms_accepted_at TIMESTAMPTZ,
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- TERRITÓRIOS
CREATE TABLE IF NOT EXISTS public.territories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT,
    name TEXT NOT NULL,
    city_id UUID REFERENCES public.cities(id),
    congregation_id TEXT REFERENCES public.congregations(id),
    status TEXT DEFAULT 'LIVRE',
    type TEXT,
    image_url TEXT,
    assigned_to UUID REFERENCES public.users(id),
    last_visit TIMESTAMPTZ,
    manual_last_completed_date TIMESTAMPTZ,
    notes TEXT,
    lat DECIMAL,
    lng DECIMAL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ENDEREÇOS
CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    territory_id UUID REFERENCES public.territories(id) ON DELETE CASCADE,
    congregation_id TEXT REFERENCES public.congregations(id),
    city_id UUID REFERENCES public.cities(id),
    street TEXT NOT NULL,
    lat DECIMAL,
    lng DECIMAL,
    google_maps_link TEXT,
    waze_link TEXT,
    resident_name TEXT,
    residents_count INTEGER DEFAULT 1, -- Quantidade de residentes no endereço
    gender TEXT, -- HOMEM, MULHER, CASAL
    is_active BOOLEAN DEFAULT true,
    is_deaf BOOLEAN DEFAULT false,
    is_minor BOOLEAN DEFAULT false,
    is_student BOOLEAN DEFAULT false,
    is_neurodivergent BOOLEAN DEFAULT false,
    observations TEXT,
    visit_status TEXT DEFAULT 'PENDENTE',
    last_visited_at TIMESTAMPTZ,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- PONTOS DE TESTEMUNHO PÚBLICO
CREATE TABLE IF NOT EXISTS public.witnessing_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    city_id UUID REFERENCES public.cities(id),
    congregation_id TEXT REFERENCES public.congregations(id),
    lat DECIMAL,
    lng DECIMAL,
    status point_status DEFAULT 'AVAILABLE',
    current_publishers TEXT[] DEFAULT '{}',
    active_users JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- LISTAS COMPARTILHADAS (Links de Território)
CREATE TABLE IF NOT EXISTS public.shared_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    territory_id UUID REFERENCES public.territories(id) ON DELETE CASCADE,
    congregation_id TEXT REFERENCES public.congregations(id),
    assigned_to UUID REFERENCES public.users(id),
    assigned_name TEXT,
    status TEXT DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- VISITAS / REGISTROS DE CAMPO
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    territory_id UUID REFERENCES public.territories(id) ON DELETE CASCADE,
    address_id UUID REFERENCES public.addresses(id) ON DELETE CASCADE,
    congregation_id TEXT REFERENCES public.congregations(id),
    user_id UUID REFERENCES public.users(id),
    notes TEXT,
    visit_date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ##########################################################
-- 3.5 FUNÇÕES DE AUXÍLIO À SEGURANÇA (Para evitar recursão no RLS)
-- ##########################################################
DROP FUNCTION IF EXISTS public.get_auth_role() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role AS $$
    SELECT role::user_role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.get_auth_congregation() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_congregation()
RETURNS TEXT AS $$
    SELECT congregation_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ##########################################################
-- 4. POLÍTICAS DE SEGURANÇA (RLS)
-- ##########################################################

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witnessing_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PARA 'SHARED_LISTS'
DROP POLICY IF EXISTS "Ver listas compartilhadas" ON public.shared_lists;
CREATE POLICY "Ver listas compartilhadas" ON public.shared_lists FOR SELECT TO authenticated USING (
    congregation_id = (select public.get_auth_congregation()) OR (select public.get_auth_role()) = 'ADMIN'
);

DROP POLICY IF EXISTS "Gerenciar listas compartilhadas" ON public.shared_lists;
CREATE POLICY "Gerenciar listas compartilhadas" ON public.shared_lists FOR ALL TO authenticated USING (
    (congregation_id = (select public.get_auth_congregation()) AND (select public.get_auth_role()) IN ('ADMIN', 'ANCIAO', 'SERVO')) OR
    (select public.get_auth_role()) = 'ADMIN'
);

-- POLÍTICAS PARA 'VISITS'
DROP POLICY IF EXISTS "Ver visitas (Admin/Ancião/Servo vêm tudo, Publicador vê suas próprias)" ON public.visits;
CREATE POLICY "Ver visitas (Admin/Ancião/Servo vêm tudo, Publicador vê suas próprias)" ON public.visits FOR SELECT TO authenticated USING (
    (select public.get_auth_role()) IN ('ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = (select public.get_auth_congregation()) OR (select public.get_auth_role()) = 'ADMIN')
    OR
    user_id = (select auth.uid())
);

DROP POLICY IF EXISTS "Inserir visitas (Todos authenticated)" ON public.visits;
CREATE POLICY "Inserir visitas (Todos authenticated)" ON public.visits FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid())
);

-- POLÍTICAS PARA 'CITIES'
DROP POLICY IF EXISTS "Admins conseguem tudo em cidades" ON public.cities;
CREATE POLICY "Admins conseguem tudo em cidades" ON public.cities FOR ALL TO authenticated USING (
    (select public.get_auth_role()) = 'ADMIN'
);
DROP POLICY IF EXISTS "Qualquer autenticado lê cidades" ON public.cities;
CREATE POLICY "Qualquer autenticado lê cidades" ON public.cities FOR SELECT TO authenticated USING (true);

-- POLÍTICAS PARA 'CONGREGATIONS'
DROP POLICY IF EXISTS "Admins conseguem tudo em congregações" ON public.congregations;
CREATE POLICY "Admins conseguem tudo em congregações" ON public.congregations FOR ALL TO authenticated USING (
    (select public.get_auth_role()) = 'ADMIN'
);
DROP POLICY IF EXISTS "Membros leem sua própria congregação" ON public.congregations;
CREATE POLICY "Membros leem sua própria congregação" ON public.congregations FOR SELECT TO authenticated USING (
    id = (select public.get_auth_congregation())
);

-- POLÍTICAS PARA 'USERS'
DROP POLICY IF EXISTS "Usuário vê seu próprio perfil" ON public.users;
CREATE POLICY "Usuário vê seu próprio perfil" ON public.users FOR SELECT TO authenticated USING (id = (select auth.uid()));
DROP POLICY IF EXISTS "Admins veem todos os usuários" ON public.users;
CREATE POLICY "Admins veem todos os usuários" ON public.users FOR SELECT TO authenticated USING (
    (select public.get_auth_role()) = 'ADMIN'
);
DROP POLICY IF EXISTS "Anciãos e Servos veem usuários da congregação" ON public.users;
CREATE POLICY "Anciãos e Servos veem usuários da congregação" ON public.users FOR SELECT TO authenticated USING (
    congregation_id = (select public.get_auth_congregation()) AND
    (select public.get_auth_role()) IN ('ADMIN', 'ADMIN', 'ANCIAO', 'SERVO')
);

-- POLÍTICAS PARA 'TERRITORIES'
DROP POLICY IF EXISTS "Ver territórios da congregação" ON public.territories;
CREATE POLICY "Ver territórios (Admin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.territories FOR SELECT TO authenticated USING (
    (select public.get_auth_role()) IN ('ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = (select public.get_auth_congregation()) OR (select public.get_auth_role()) = 'ADMIN')
    OR
    assigned_to = (select auth.uid())
);

DROP POLICY IF EXISTS "Editar territórios (Anciãos/Servos/Admins)" ON public.territories;
CREATE POLICY "Gerenciar territórios (Ancião/Servo/Admin)" ON public.territories FOR ALL TO authenticated USING (
    ((congregation_id = (select public.get_auth_congregation()) AND
     (select public.get_auth_role()) IN ('ADMIN', 'ANCIAO', 'SERVO'))) OR
    (select public.get_auth_role()) = 'ADMIN'
);

-- POLÍTICAS PARA 'ADDRESSES'
DROP POLICY IF EXISTS "Ver endereços da congregação" ON public.addresses;
CREATE POLICY "Ver endereços (Admin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.addresses FOR SELECT TO authenticated USING (
    (select public.get_auth_role()) IN ('ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = (select public.get_auth_congregation()) OR (select public.get_auth_role()) = 'ADMIN')
    OR
    territory_id IN (SELECT id FROM public.territories WHERE assigned_to = (select auth.uid()))
);

DROP POLICY IF EXISTS "Gerenciar endereços (Anciãos/Servos/Admins)" ON public.addresses;
CREATE POLICY "Gerenciar endereços (Ancião/Servo/Admin)" ON public.addresses FOR ALL TO authenticated USING (
    ((congregation_id = (select public.get_auth_congregation()) AND
     (select public.get_auth_role()) IN ('ADMIN', 'ANCIAO', 'SERVO'))) OR
    (select public.get_auth_role()) = 'ADMIN'
);

-- POLÍTICAS PARA 'WITNESSING_POINTS' (Testemunho Público)
DROP POLICY IF EXISTS "Ver pontos de testemunho" ON public.witnessing_points;
CREATE POLICY "Ver pontos de testemunho" ON public.witnessing_points FOR SELECT TO authenticated USING (
    congregation_id = (select public.get_auth_congregation()) OR
    (select public.get_auth_role()) = 'ADMIN'
);
DROP POLICY IF EXISTS "Atualizar pontos de testemunho" ON public.witnessing_points;
CREATE POLICY "Atualizar pontos de testemunho" ON public.witnessing_points FOR UPDATE TO authenticated USING (
    congregation_id = (select public.get_auth_congregation()) OR
    (select public.get_auth_role()) = 'ADMIN'
);
DROP POLICY IF EXISTS "Admin total em pontos" ON public.witnessing_points;
CREATE POLICY "Admin total em pontos" ON public.witnessing_points FOR ALL TO authenticated USING (
    (congregation_id = (select public.get_auth_congregation()) AND
     (select public.get_auth_role()) IN ('ADMIN', 'ANCIAO', 'SERVO')) OR
    (select public.get_auth_role()) = 'ADMIN'
);

-- ##########################################################
-- 5. TRIGGERS E FUNÇÕES AUTOMÁTICAS
-- ##########################################################

-- Função para atualizar o 'updated_at' automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Aplicar o trigger em todas as tabelas relevantes
DROP TRIGGER IF EXISTS update_cities_updated_at ON public.cities;
CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON public.cities FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_congregations_updated_at ON public.congregations;
CREATE TRIGGER update_congregations_updated_at BEFORE UPDATE ON public.congregations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_territories_updated_at ON public.territories;
CREATE TRIGGER update_territories_updated_at BEFORE UPDATE ON public.territories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_addresses_updated_at ON public.addresses;
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_witnessing_points_updated_at ON public.witnessing_points;
CREATE TRIGGER update_witnessing_points_updated_at BEFORE UPDATE ON public.witnessing_points FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ##########################################################
-- 6. ÍNDICES PARA PERFORMANCE
-- ##########################################################
CREATE INDEX IF NOT EXISTS idx_territories_congregation ON public.territories(congregation_id);
CREATE INDEX IF NOT EXISTS idx_addresses_territory ON public.addresses(territory_id);
CREATE INDEX IF NOT EXISTS idx_shared_lists_territory ON public.shared_lists(territory_id);
CREATE INDEX IF NOT EXISTS idx_visits_territory ON public.visits(territory_id);
CREATE INDEX IF NOT EXISTS idx_users_congregation ON public.users(congregation_id);
-- STATUS DE BUG REPORT
DO $$ BEGIN
    CREATE TYPE bug_report_status AS ENUM (
        'NEW',          -- Novo / Não Lido
        'VIEWED',       -- Visualizado
        'DEFERRED',     -- Deferido (Pendente de análise técnica)
        'ACCEPTED',     -- Aceito (Em fila de correção)
        'RESOLVED'      -- Resolvido
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- RELATOS DE BUGS
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    title TEXT NOT NULL,
    description TEXT,
    device_info JSONB, -- {platform, version, browser, zoom, consoleLogs, etc}
    status bug_report_status DEFAULT 'NEW',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS PARA BUGS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários criam seus próprios reports" ON public.bug_reports;
CREATE POLICY "Usuários criam seus próprios reports" ON public.bug_reports 
FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuários veem seus próprios reports" ON public.bug_reports;
CREATE POLICY "Usuários veem seus próprios reports" ON public.bug_reports 
FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins gerenciam tudo em bugs" ON public.bug_reports;
CREATE POLICY "Admins gerenciam tudo em bugs" ON public.bug_reports 
FOR ALL TO authenticated USING ((select public.get_auth_role()) = 'ADMIN');
