import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const url = new URL(req.url);
        const congregation_id = url.searchParams.get('congregationId');
        const territory_id = url.searchParams.get('territoryId');

        if (!congregation_id || !territory_id) {
            return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 });
        }

        // Verificar permissão
        const { data: adminData } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        if (!adminData || (adminData.role !== 'SUPER_ADMIN' && adminData.congregation_id !== congregation_id)) {
            return NextResponse.json({ error: 'Acesso negado à congregação.' }, { status: 403 });
        }

        const { data: addresses, error } = await supabaseAdmin
            .from('addresses')
            .select('*')
            .eq('congregation_id', congregation_id)
            .eq('territory_id', territory_id)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error("Supabase Admin Error:", error);
            throw error;
        }

        return NextResponse.json({ addresses: addresses || [] });
    } catch (error: any) {
        console.error("List Addresses API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
