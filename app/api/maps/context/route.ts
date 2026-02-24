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

        // Check auth for this congregation (Try ID + Email verification)
        let { data: adminData } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id, email')
            .eq('id', currentUser.id)
            .single();

        if (!adminData || (currentUser.email && adminData.email !== currentUser.email)) {
            const { data: fallbackData } = await supabaseAdmin
                .from('users')
                .select('role, congregation_id, email')
                .eq('email', currentUser.email)
                .single();
            if (fallbackData) adminData = fallbackData;
        }

        // Permite visualizar se for SUPER_ADMIN ou se a congregationId bater com o registro do usuário
        const userCong = String(adminData?.congregation_id || '').toLowerCase().trim();
        const reqCong = String(congregationId || '').toLowerCase().trim();

        const isAllowed = adminData && (
            adminData.role === 'SUPER_ADMIN' ||
            (userCong === reqCong && (['ELDER', 'SERVANT', 'ADMIN', 'ANCIAO', 'SERVO'].includes(adminData.role || '')))
        );

        if (!isAllowed) {
            return NextResponse.json({ error: 'Você não tem acesso a essa congregação' }, { status: 403 });
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
