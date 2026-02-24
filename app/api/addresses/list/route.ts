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

        if (!congregationId || !cityId) {
            return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 });
        }

        // Auth Logic (Try ID + Email verification)
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

        const userCong = String(adminData?.congregation_id || '').toLowerCase().trim();
        const reqCong = String(congregationId || '').toLowerCase().trim();

        const isAllowed = adminData && (
            adminData.role === 'SUPER_ADMIN' ||
            (userCong === reqCong && (['ELDER', 'SERVANT', 'ADMIN', 'ANCIAO', 'SERVO'].includes(adminData.role || '')))
        );

        if (!isAllowed) {
            return NextResponse.json({ error: 'Você não tem acesso a essa congregação' }, { status: 403 });
        }

        // Fetch addresses using Admin to bypass RLS
        let query = supabaseAdmin
            .from('addresses')
            .select('id, territory_id, is_active, street, resident_name, observations, gender, is_deaf, is_neurodivergent, is_student, is_minor, inactivated_at')
            .eq('congregation_id', congregationId);

        if (territoryId) {
            query = query.eq('territory_id', territoryId);
        } else if (cityId) {
            query = query.eq('city_id', cityId);
        }

        const { data: addresses, error: aErr } = await query;
        if (aErr) throw aErr;

        // 2. Fetch Latest Visits for these addresses
        const { data: latestVisits, error: vErr } = await supabaseAdmin
            .from('visits')
            .select('address_id, status, created_at')
            .in('address_id', (addresses || []).map(a => a.id))
            .order('created_at', { ascending: false });

        if (vErr) console.error("[ADDRESS LIST API] Visits fetch error:", vErr);

        // Map latest visit to each address
        const addressesWithStatus = (addresses || []).map(addr => {
            const lastVisit = (latestVisits || []).find(v => v.address_id === addr.id);
            return {
                ...addr,
                visit_status: lastVisit?.status || 'none',
                last_visited_at: lastVisit?.created_at
            };
        });

        return NextResponse.json({ success: true, addresses: addressesWithStatus });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
