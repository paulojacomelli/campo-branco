import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const url = new URL(req.url);
        const congregationId = url.searchParams.get('congregationId');

        // Add auth checking logic
        const { data: adminData } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        // Permite visualizar quem é SUPER_ADMIN ou se a congregationId bate
        if (!adminData || (adminData.role !== 'SUPER_ADMIN' && adminData.congregation_id !== congregationId)) {
            return NextResponse.json({ error: 'Você não tem permissão para visualizar estas cidades.' }, { status: 403 });
        }

        // Usa o supabaseAdmin (Service Key) para forçar o bypass do RLS para Select
        const { data: cities, error: tErr } = await supabaseAdmin
            .from('cities')
            .select('*')
            .eq('congregation_id', congregationId)
            .order('name');

        return NextResponse.json({ success: true, cities, error: tErr });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
