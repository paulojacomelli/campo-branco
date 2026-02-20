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

        const { ids } = await req.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Nenhum cartão selecionado para exclusão.' }, { status: 400 });
        }

        // 1. Verificar permissões do usuário
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', user.id)
            .single();

        if (userError || !userData) {
            console.error('User check error:', userError);
            return NextResponse.json({ error: 'Erro ao verificar permissões.' }, { status: 500 });
        }

        const isAuthorized = userData.role === 'SUPER_ADMIN' ||
            userData.role === 'ADMIN' ||
            userData.role === 'ELDER' ||
            userData.role === 'SERVANT';

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Você não tem permissão para realizar exclusões em massa.' }, { status: 403 });
        }

        console.log(`DEBUG - Iniciando exclusão via Admin de ${ids.length} cartões por usuário ${user.id}`);

        // 2. Executar delete via Admin Client (ignora RLS)
        const { error: deleteError } = await supabaseAdmin
            .from('shared_lists')
            .delete()
            .in('id', ids);

        if (deleteError) {
            console.error('Delete API Error:', deleteError);
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        console.log(`DEBUG - Sucesso! ${ids.length} cartões excluídos.`);

        return NextResponse.json({
            success: true,
            message: `${ids.length} cartões excluídos com sucesso.`
        });
    } catch (error: any) {
        console.error('Card Delete API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
