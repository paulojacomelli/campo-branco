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

        const { userId, name, role, congregation_id } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
        }

        // 1. Verificar permissões do administrador
        const { data: adminData } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        if (!adminData || (adminData.role !== 'SUPER_ADMIN' && adminData.role !== 'ANCIAO' && adminData.role !== 'SERVO')) {
            return NextResponse.json({ error: 'Você não tem permissão para atualizar usuários.' }, { status: 403 });
        }

        // 2. Verificar o usuário alvo
        const { data: targetUser } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id')
            .eq('id', userId)
            .single();

        if (!targetUser) {
            return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
        }

        // 3. Regras de segurança adicionais
        if (adminData.role !== 'SUPER_ADMIN') {
            // Se for Ancião ou Servo, só edita da própria congregação
            if (targetUser.congregation_id !== adminData.congregation_id) {
                return NextResponse.json({ error: 'Você só pode editar usuários da sua congregação.' }, { status: 403 });
            }
            if (targetUser.role === 'SUPER_ADMIN') {
                return NextResponse.json({ error: 'Você não pode editar um Super Admin.' }, { status: 403 });
            }
            if (role === 'SUPER_ADMIN') {
                return NextResponse.json({ error: 'Você não pode promover alguém a Super Admin.' }, { status: 403 });
            }
        }

        console.log(`DEBUG - Iniciando atualização via Admin de usuário ${userId} por admin ${currentUser.id}`);

        // 4. Atualizar na tabela pública via Admin (bypasses RLS)
        const { error: publicUpdateError } = await supabaseAdmin
            .from('users')
            .update({
                name: name,
                role: role,
                congregation_id: congregation_id
            })
            .eq('id', userId);

        if (publicUpdateError) {
            console.error('Public User Update API Error:', publicUpdateError);
            return NextResponse.json({ error: publicUpdateError.message }, { status: 500 });
        }

        // 5. Atualizar nome no auth (opcional, mas recomendado)
        if (name) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
                user_metadata: { name: name }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('User Update API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
