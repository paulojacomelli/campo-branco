import { createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Cliente Admin para ignorar RLS durante a transição/manutenção
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const { id, updates } = await req.json();

        if (!id || !updates) {
            return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
        }

        // 1. Verificar se o usuário existe e está ativo (opcional, dependendo da necessidade de segurança)
        // Por enquanto, permitimos que qualquer usuário autenticado faça check-in/out

        // 2. Executar a atualização via Admin para garantir que o check-in funcione
        // mesmo que o ponto esteja com dados órfãos (congregação desalinhada)
        const { data, error } = await supabaseAdmin
            .from('witnessing_points')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Check-in API Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Ponto não encontrado' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: data[0] });
    } catch (error: any) {
        console.error('Check-in API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
