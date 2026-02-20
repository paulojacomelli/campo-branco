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
        const { id, name, notes } = body;

        if (!id || !name) {
            return NextResponse.json({ error: 'ID e Nome são obrigatórios.' }, { status: 400 });
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

        // Obter território alvo para verificar congregação (usando admin para ignorar RLS)
        const { data: territoryData } = await supabaseAdmin
            .from('territories')
            .select('congregation_id')
            .eq('id', id)
            .single();

        if (!territoryData) {
            return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
        }

        // Se for Ancião/Servo, só pode atualizar da própria congregação
        if (adminData.role !== 'SUPER_ADMIN' && territoryData.congregation_id !== adminData.congregation_id) {
            return NextResponse.json({ error: 'Você só pode atualizar itens da sua congregação.' }, { status: 403 });
        }

        const { data, error: publicUpdateError } = await supabaseAdmin
            .from('territories')
            .update({
                name,
                notes: notes || null
            })
            .eq('id', id);

        if (publicUpdateError) {
            console.error('Territory Update API Error:', publicUpdateError);
            return NextResponse.json({ error: publicUpdateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Territory Update API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
