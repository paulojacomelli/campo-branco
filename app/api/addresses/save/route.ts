import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const body = await req.json();
        const {
            street, territory_id, congregation_id, city_id, lat, lng,
            is_active, google_maps_link, waze_link, resident_name, gender,
            is_deaf, is_minor, is_student, is_neurodivergent, observations, id,
            inactivated_at
        } = body;

        // Check if user belongs to the congregation
        const { data: adminData } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        const userCong = String(adminData?.congregation_id || '').toLowerCase().trim();
        const reqCong = String(congregation_id || '').toLowerCase().trim();

        if (!adminData || (adminData.role !== 'SUPER_ADMIN' && userCong !== reqCong)) {
            return NextResponse.json({ error: 'Você não tem permissão nesta congregação.' }, { status: 403 });
        }

        const addressData = {
            street,
            territory_id,
            congregation_id,
            city_id,
            lat,
            lng,
            is_active,
            google_maps_link,
            waze_link,
            resident_name,
            gender,
            is_deaf,
            is_minor,
            is_student,
            is_neurodivergent,
            observations,
            inactivated_at
        };

        if (id) {
            // Update
            const { error: updateError } = await supabaseAdmin.from('addresses').update(addressData).eq('id', id);
            if (updateError) throw updateError;
        } else {
            // Insert
            const { error: insertError } = await supabaseAdmin.from('addresses').insert({
                ...addressData,
                created_at: new Date().toISOString()
            });
            if (insertError) throw insertError;
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("API Address Save Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
