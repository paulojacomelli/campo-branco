import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
        }

        // Get user profile for verification
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id')
            .eq('id', user.id)
            .single();

        // Security: Verify that the item to be deleted belongs to the user's congregation
        // unless they are a superadmin (and even then, we want to restrict them in operational views)
        const { data: existingList, error: fetchError } = await supabaseAdmin
            .from('shared_lists')
            .select('congregation_id')
            .eq('id', id)
            .single();

        if (fetchError || !existingList) {
            return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
        }

        if (profile?.role !== 'SUPER_ADMIN' && existingList.congregation_id !== profile?.congregation_id) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('shared_lists')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Shared List Delete API Error:", error);
        return NextResponse.json({
            error: error.message || 'Erro interno no servidor'
        }, { status: 500 });
    }
}
