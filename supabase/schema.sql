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
        'SUPER_ADMIN', 
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
    id TEXT PRIMARY KEY, -- Alterado para TEXT para permitir IDs personalizados
    name TEXT NOT NULL,
    number TEXT,
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
BEGIN
    RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.get_auth_congregation() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_congregation()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT congregation_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

-- POLÍTICAS PARA 'VISITS'
DROP POLICY IF EXISTS "Ver visitas (Superadmin/Ancião/Servo vêm tudo, Publicador vê suas próprias)" ON public.visits;
CREATE POLICY "Ver visitas (Superadmin/Ancião/Servo vêm tudo, Publicador vê suas próprias)" ON public.visits FOR SELECT TO authenticated USING (
    get_auth_role() IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = get_auth_congregation() OR get_auth_role() = 'SUPER_ADMIN')
    OR
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "Inserir visitas (Todos authenticated)" ON public.visits;
CREATE POLICY "Inserir visitas (Todos authenticated)" ON public.visits FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
);

-- POLÍTICAS PARA 'CITIES'
DROP POLICY IF EXISTS "SuperAdmins conseguem tudo em cidades" ON public.cities;
CREATE POLICY "SuperAdmins conseguem tudo em cidades" ON public.cities FOR ALL TO authenticated USING (
    get_auth_role() = 'SUPER_ADMIN'
);
DROP POLICY IF EXISTS "Qualquer autenticado lê cidades" ON public.cities;
CREATE POLICY "Qualquer autenticado lê cidades" ON public.cities FOR SELECT TO authenticated USING (true);

-- POLÍTICAS PARA 'CONGREGATIONS'
DROP POLICY IF EXISTS "SuperAdmins conseguem tudo em congregações" ON public.congregations;
CREATE POLICY "SuperAdmins conseguem tudo em congregações" ON public.congregations FOR ALL TO authenticated USING (
    get_auth_role() = 'SUPER_ADMIN'
);
DROP POLICY IF EXISTS "Membros leem sua própria congregação" ON public.congregations;
CREATE POLICY "Membros leem sua própria congregação" ON public.congregations FOR SELECT TO authenticated USING (
    id = get_auth_congregation()
);

-- POLÍTICAS PARA 'USERS'
DROP POLICY IF EXISTS "Usuário vê seu próprio perfil" ON public.users;
CREATE POLICY "Usuário vê seu próprio perfil" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "SuperAdmins veem todos os usuários" ON public.users;
CREATE POLICY "SuperAdmins veem todos os usuários" ON public.users FOR SELECT TO authenticated USING (
    get_auth_role() = 'SUPER_ADMIN'
);
DROP POLICY IF EXISTS "Anciãos e Servos veem usuários da congregação" ON public.users;
CREATE POLICY "Anciãos e Servos veem usuários da congregação" ON public.users FOR SELECT TO authenticated USING (
    congregation_id = get_auth_congregation() AND
    get_auth_role() IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO')
);

-- POLÍTICAS PARA 'TERRITORIES'
DROP POLICY IF EXISTS "Ver territórios da congregação" ON public.territories;
CREATE POLICY "Ver territórios (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.territories FOR SELECT TO authenticated USING (
    get_auth_role() IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = get_auth_congregation() OR get_auth_role() = 'SUPER_ADMIN')
    OR
    assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Editar territórios (Anciãos/Servos/Admins)" ON public.territories;
CREATE POLICY "Gerenciar territórios (Ancião/Servo/Superadmin)" ON public.territories FOR ALL TO authenticated USING (
    ((congregation_id = get_auth_congregation() AND
     get_auth_role() IN ('ADMIN', 'ANCIAO', 'SERVO'))) OR
    get_auth_role() = 'SUPER_ADMIN'
);

-- POLÍTICAS PARA 'ADDRESSES'
DROP POLICY IF EXISTS "Ver endereços da congregação" ON public.addresses;
CREATE POLICY "Ver endereços (Superadmin/Ancião/Servo vêm tudo, Publicador vê seus próprios)" ON public.addresses FOR SELECT TO authenticated USING (
    get_auth_role() IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO') AND (congregation_id = get_auth_congregation() OR get_auth_role() = 'SUPER_ADMIN')
    OR
    territory_id IN (SELECT id FROM public.territories WHERE assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "Gerenciar endereços (Anciãos/Servos/Admins)" ON public.addresses;
CREATE POLICY "Gerenciar endereços (Ancião/Servo/Superadmin)" ON public.addresses FOR ALL TO authenticated USING (
    ((congregation_id = get_auth_congregation() AND
     get_auth_role() IN ('ADMIN', 'ANCIAO', 'SERVO'))) OR
    get_auth_role() = 'SUPER_ADMIN'
);

-- POLÍTICAS PARA 'WITNESSING_POINTS' (Testemunho Público)
DROP POLICY IF EXISTS "Ver pontos de testemunho" ON public.witnessing_points;
CREATE POLICY "Ver pontos de testemunho" ON public.witnessing_points FOR SELECT TO authenticated USING (
    congregation_id = get_auth_congregation() OR
    get_auth_role() = 'SUPER_ADMIN'
);
DROP POLICY IF EXISTS "Qualquer um pode fazer check-in/out (via updates controlados)" ON public.witnessing_points;
CREATE POLICY "Qualquer um pode fazer check-in/out (via updates controlados)" ON public.witnessing_points FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin total em pontos" ON public.witnessing_points;
CREATE POLICY "Admin total em pontos" ON public.witnessing_points FOR ALL TO authenticated USING (
    (congregation_id = get_auth_congregation() AND
     get_auth_role() IN ('ADMIN', 'ANCIAO', 'SERVO')) OR
    get_auth_role() = 'SUPER_ADMIN'
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
$$ language 'plpgsql';

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
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários veem seus próprios reports" ON public.bug_reports;
CREATE POLICY "Usuários veem seus próprios reports" ON public.bug_reports 
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "SuperAdmins gerenciam tudo em bugs" ON public.bug_reports;
CREATE POLICY "SuperAdmins gerenciam tudo em bugs" ON public.bug_reports 
FOR ALL TO authenticated USING (get_auth_role() = 'SUPER_ADMIN');
