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
        const cityId = url.searchParams.get('cityId');
        const territoryId = url.searchParams.get('territoryId');

        // Check auth for this congregation
        const { data: adminData } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        if (!adminData || (adminData.role !== 'SUPER_ADMIN' && adminData.congregation_id !== congregationId)) {
            return NextResponse.json({ error: 'Você não tem permissão para visualizar.' }, { status: 403 });
        }

        // Fetch using Admin to bypass RLS
        const [congRes, cityRes, terrRes] = await Promise.all([
            congregationId ? supabaseAdmin.from('congregations').select('name, term_type, category').eq('id', congregationId).single() : Promise.resolve({ data: null }),
            cityId ? supabaseAdmin.from('cities').select('name, parent_city').eq('id', cityId).single() : Promise.resolve({ data: null }),
            territoryId ? supabaseAdmin.from('territories').select('name, notes').eq('id', territoryId).single() : Promise.resolve({ data: null })
        ]);

        return NextResponse.json({
            success: true,
            congregation: congRes.data,
            city: cityRes.data,
            territory: terrRes.data
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
