
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        // 1. Verificar Autenticação (Apenas Super Admins)
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('Auth check failed:', authError);
            return NextResponse.json({ error: 'Sessão expirada ou não encontrada' }, { status: 401 });
        }

        // Verificar role de super admin na tabela 'users'
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (userError || userData?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acesso restrito a Super Admins' }, { status: 403 });
        }

        const { id, type, updates } = await req.json();

        if (!id || !type || !updates) {
            return NextResponse.json({ error: 'ID, tipo e dados de atualização são obrigatórios' }, { status: 400 });
        }

        const tableName = type === 'address' ? 'addresses' :
            type === 'territory' ? 'territories' :
                type === 'witnessing' ? 'witnessing_points' :
                    type === 'visit' ? 'visits' : 'cities';

        // 2. Executar update com Admin Client (bypasses RLS)
        // Isso é necessário porque o registro órfão pode não pertencer a nenhuma congregação
        // e as políticas de RLS normais bloqueiam a edição de registros sem congregação_id combinando.
        const { data, error } = await supabaseAdmin
            .from(tableName)
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error(`Admin Repair Error [${tableName}]:`, error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Nenhum registro encontrado para atualizar' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: data[0] });
    } catch (error: any) {
        console.error('Repair API Critical Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
