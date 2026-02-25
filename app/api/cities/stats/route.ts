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
        let congregationId = url.searchParams.get('congregationId');
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        // Tenta buscar o perfil do usuário
        const { data: adminData } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        // Security: Force congregationId to be the user's congregation for operational views
        if (adminData?.role !== 'ADMIN' || !congregationId) {
            congregationId = adminData?.congregation_id || null;
        }

        if (!congregationId) {
            return NextResponse.json({ error: 'Congregação não identificada' }, { status: 400 });
        }

        // 1. Fetch all territories for this congregation
        const { data: territories, error: terrError } = await supabaseAdmin
            .from('territories')
            .select('id, city_id, name, notes')
            .eq('congregation_id', congregationId);

        if (terrError) throw terrError;

        // 2. Fetch completed assignments in range
        let queryHistory = supabaseAdmin
            .from('shared_lists')
            .select('*')
            .eq('congregation_id', congregationId)
            .eq('status', 'completed');

        if (startDate) queryHistory = queryHistory.gte('returned_at', startDate);
        if (endDate) queryHistory = queryHistory.lte('returned_at', endDate);

        const { data: history, error: historyError } = await queryHistory;
        if (historyError) throw historyError;

        // 3. Fetch Addresses visits in range
        let queryAddresses = supabaseAdmin
            .from('addresses')
            .select('id, city_id, territory_id, visit_status, last_visited_at')
            .eq('congregation_id', congregationId);

        if (startDate) queryAddresses = queryAddresses.gte('last_visited_at', startDate);
        if (endDate) queryAddresses = queryAddresses.lte('last_visited_at', endDate);

        const { data: addresses, error: addrError } = await queryAddresses;
        if (addrError) throw addrError;

        return NextResponse.json({
            success: true,
            territories: territories || [],
            history: history || [],
            addresses: addresses || []
        });
    } catch (error: any) {
        console.error("Cities Stats API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
