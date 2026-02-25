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
        const idsParam = url.searchParams.get('ids');

        if (!idsParam) {
            return NextResponse.json({ error: 'IDs não fornecidos' }, { status: 400 });
        }

        const ids = idsParam.split(',').filter(Boolean);

        // 1. Get user details to check congregation
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'Perfil de usuário não encontrado' }, { status: 403 });
        }

        // 2. Fetch territories using admin client to bypass RLS
        const { data: territories, error: tErr } = await supabaseAdmin
            .from('territories')
            .select('*')
            .in('id', ids);

        if (tErr) {
            return NextResponse.json({ error: 'Erro ao buscar territórios', details: tErr.message }, { status: 500 });
        }

        if (!territories || territories.length === 0) {
            return NextResponse.json({ success: true, territories: [] });
        }

        // 3. SECURE: Verify that ALL territories belong to the same congregation as the user
        // (Unless the user is a ADMIN)
        if (userData.role !== 'ADMIN') {
            const hasUnauthorized = territories.some(t => t.congregation_id !== userData.congregation_id);
            if (hasUnauthorized) {
                return NextResponse.json({ error: 'Você não tem permissão para acessar alguns dos territórios solicitados.' }, { status: 403 });
            }
        }

        return NextResponse.json({
            success: true,
            territories
        });

    } catch (error: any) {
        console.error("Critical Error in /api/territories/details:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
