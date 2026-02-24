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

        const body = await req.json();
        const { id, mode = 'cascade' } = body; // mode can be 'cascade' or 'orphan'

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });
        }

        // Verificar permissões do administrador
        const { data: adminData } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        if (!adminData || (adminData.role !== 'SUPER_ADMIN' && adminData.role !== 'ANCIAO' && adminData.role !== 'SERVO')) {
            return NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 });
        }

        // Obter território alvo para verificar congregação (usando admin para ignorar RLS no SELECT)
        const { data: territoryData } = await supabaseAdmin
            .from('territories')
            .select('congregation_id')
            .eq('id', id)
            .single();

        if (!territoryData) {
            return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
        }

        // Se for Ancião/Servo, só pode deletar da própria congregação
        if (adminData.role !== 'SUPER_ADMIN' && territoryData.congregation_id !== adminData.congregation_id) {
            return NextResponse.json({ error: 'Você só pode excluir itens da sua congregação.' }, { status: 403 });
        }

        // Tratamento de endereços vinculados
        if (mode === 'orphan') {
            // Deixa os endereços "órfãos" (sem território vinculado)
            const { error: orphanError } = await supabaseAdmin
                .from('addresses')
                .update({ territory_id: null })
                .eq('territory_id', id);

            if (orphanError) {
                console.error('Territory Orphan API Error:', orphanError);
                return NextResponse.json({ error: 'Erro ao desvincular endereços.' }, { status: 500 });
            }
        } else {
            // Cascade: Deleta os endereços vinculados primeiro
            const { error: cascadeError } = await supabaseAdmin
                .from('addresses')
                .delete()
                .eq('territory_id', id);

            if (cascadeError) {
                console.error('Territory Cascade API Error:', cascadeError);
                return NextResponse.json({ error: 'Erro ao excluir endereços vinculados.' }, { status: 500 });
            }
        }

        const { error: publicDeleteError } = await supabaseAdmin
            .from('territories')
            .delete()
            .eq('id', id);

        if (publicDeleteError) {
            console.error('Territory Delete API Error:', publicDeleteError);
            return NextResponse.json({ error: publicDeleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Territory Delete API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
