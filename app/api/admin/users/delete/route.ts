import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
        }

        // 1. Verificar permissões do administrador
        const { data: adminData } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        if (!adminData || (adminData.role !== 'SUPER_ADMIN' && adminData.role !== 'ANCIAO')) {
            return NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 });
        }

        // 2. Verificar o usuário alvo
        const { data: targetUser } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', userId)
            .single();

        if (!targetUser) {
            return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
        }

        // 3. Regras de segurança adicionais
        if (adminData.role !== 'SUPER_ADMIN') {
            // Se for Ancião, só deleta da própria congregação e não pode deletar Super Admin ou outro Ancião
            if (targetUser.congregation_id !== adminData.congregation_id) {
                return NextResponse.json({ error: 'Você só pode excluir usuários da sua congregação.' }, { status: 403 });
            }
            if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ANCIAO') {
                return NextResponse.json({ error: 'Você não tem permissão para excluir este nível de usuário.' }, { status: 403 });
            }
        }

        console.log(`DEBUG - Iniciando exclusão via Admin de usuário ${userId} por admin ${currentUser.id}`);

        // 4. Excluir da tabela pública via Admin (bypasses RLS)
        const { error: publicDeleteError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', userId);

        if (publicDeleteError) {
            console.error('Public User Delete API Error:', publicDeleteError);
            return NextResponse.json({ error: publicDeleteError.message }, { status: 500 });
        }

        // 5. Excluir do Auth (opcional, mas recomendado para limpar totalmente)
        // Nota: O Supabase costuma ter proteção contra deletar a si mesmo e usuários via API admin
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            console.warn('Auth User Delete warning (might be already deleted or protected):', authDeleteError.message);
            // Não falhamos o processo se o auth falhar (ex: usuário já removido do auth mas ficou no profile)
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('User Delete API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
