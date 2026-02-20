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
    state TEXT,
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
    number TEXT,
    neighborhood TEXT,
    coordinates JSONB, -- {lat, lng}
    notes TEXT,
    last_visit TIMESTAMPTZ,
    status TEXT DEFAULT 'PENDENTE',
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

-- POLÍTICAS PARA 'CITIES'
CREATE POLICY "SuperAdmins conseguem tudo em cidades" ON public.cities ALL TO authenticated USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);
CREATE POLICY "Qualquer autenticado lê cidades" ON public.cities FOR SELECT TO authenticated USING (true);

-- POLÍTICAS PARA 'CONGREGATIONS'
CREATE POLICY "SuperAdmins conseguem tudo em congregações" ON public.congregations ALL TO authenticated USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);
CREATE POLICY "Membros leem sua própria congregação" ON public.congregations FOR SELECT TO authenticated USING (
    id = (SELECT congregation_id FROM public.users WHERE id = auth.uid())
);

-- POLÍTICAS PARA 'USERS'
CREATE POLICY "Usuário vê seu próprio perfil" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "SuperAdmins veem todos os usuários" ON public.users FOR SELECT TO authenticated USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);
CREATE POLICY "Anciãos e Servos veem usuários da congregação" ON public.users FOR SELECT TO authenticated USING (
    congregation_id = (SELECT congregation_id FROM public.users WHERE id = auth.uid()) AND
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN', 'ANCIAO', 'SERVO')
);

-- POLÍTICAS PARA 'TERRITORIES'
CREATE POLICY "Ver territórios da congregação" ON public.territories FOR SELECT TO authenticated USING (
    congregation_id = (SELECT congregation_id FROM public.users WHERE id = auth.uid()) OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);
CREATE POLICY "Editar territórios (Anciãos/Servos/Admins)" ON public.territories FOR ALL TO authenticated USING (
    (congregation_id = (SELECT congregation_id FROM public.users WHERE id = auth.uid()) AND
     (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'ANCIAO', 'SERVO')) OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

-- POLÍTICAS PARA 'ADDRESSES'
CREATE POLICY "Ver endereços da congregação" ON public.addresses FOR SELECT TO authenticated USING (
    congregation_id = (SELECT congregation_id FROM public.users WHERE id = auth.uid()) OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);
CREATE POLICY "Gerenciar endereços (Anciãos/Servos/Admins)" ON public.addresses FOR ALL TO authenticated USING (
    (congregation_id = (SELECT congregation_id FROM public.users WHERE id = auth.uid()) AND
     (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'ANCIAO', 'SERVO')) OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

-- POLÍTICAS PARA 'WITNESSING_POINTS' (Testemunho Público)
CREATE POLICY "Ver pontos de testemunho" ON public.witnessing_points FOR SELECT TO authenticated USING (
    congregation_id = (SELECT congregation_id FROM public.users WHERE id = auth.uid()) OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);
CREATE POLICY "Qualquer um pode fazer check-in/out (via updates controlados)" ON public.witnessing_points FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin total em pontos" ON public.witnessing_points FOR ALL TO authenticated USING (
    (congregation_id = (SELECT congregation_id FROM public.users WHERE id = auth.uid()) AND
     (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'ANCIAO', 'SERVO')) OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
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
CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON public.cities FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_congregations_updated_at BEFORE UPDATE ON public.congregations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_territories_updated_at BEFORE UPDATE ON public.territories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
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

CREATE POLICY "Usuários criam seus próprios reports" ON public.bug_reports 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários veem seus próprios reports" ON public.bug_reports 
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "SuperAdmins gerenciam tudo em bugs" ON public.bug_reports 
FOR ALL TO authenticated USING (public.get_my_role() = 'SUPER_ADMIN');
