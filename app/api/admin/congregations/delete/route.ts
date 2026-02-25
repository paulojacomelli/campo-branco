import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        // 1. Verificar se é Super Admin
        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        const { id, force } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'ID da congregação é obrigatório.' }, { status: 400 });
        }

        console.log(`DEBUG - Solicitando exclusão de congregação: ${id} (Force: ${force}) por admin ${user.id}`);

        if (force === true) {
            console.log(`DEBUG - Executando limpeza total para congregação ${id}...`);
            const tables = ['cities', 'users', 'territories', 'addresses', 'witnessing_points', 'shared_lists', 'visits'];

            for (const table of tables) {
                if (table === 'users' || table === 'cities') {
                    // Para usuários e cidades, apenas removemos o vínculo (null)
                    await supabaseAdmin.from(table).update({ congregation_id: null }).eq('congregation_id', id);
                } else {
                    // Para territórios e outros dados operacionais, removemos tudo
                    await supabaseAdmin.from(table).delete().eq('congregation_id', id);
                }
            }
        }

        // 2. Tentar excluir a congregação
        const { error: deleteError } = await supabaseAdmin
            .from('congregations')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Congregation Delete API Error:', deleteError);

            // Tratamento amigável para erro de chave estrangeira
            if (deleteError.code === '23503') {
                return NextResponse.json({
                    code: 'HAS_RELATIONS',
                    error: 'Esta congregação possui dados vinculados (cidades, territórios, etc). Deseja realizar uma limpeza total e excluir assim mesmo?'
                }, { status: 400 });
            }

            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Congregation Delete API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
