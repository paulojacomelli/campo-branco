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
        const cityId = url.searchParams.get('cityId');
        let congregationId = url.searchParams.get('congregationId');

        // Add auth checking logic
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

        // Security: Force congregationId to be the user's congregation for operational views
        // Superadmins can no longer jump between congregations in these views.
        if (adminData?.role !== 'SUPER_ADMIN' || !congregationId) {
            congregationId = adminData?.congregation_id || null;
        }

        const isAllowed = adminData && (
            adminData.role === 'SUPER_ADMIN' ||
            (['ELDER', 'SERVANT', 'ADMIN', 'ANCIAO', 'SERVO'].includes(adminData.role || ''))
        );

        if (!isAllowed || !congregationId) {
            return NextResponse.json({ error: 'Você não tem acesso a essa congregação' }, { status: 403 });
        }

        // 1. Busca os territórios
        const { data: territories, error: tErr } = await supabaseAdmin
            .from('territories')
            .select('*')
            .eq('city_id', cityId)
            .eq('congregation_id', congregationId)
            .order('name');

        if (tErr) throw tErr;

        if (!territories || territories.length === 0) {
            return NextResponse.json({ success: true, territories: [] });
        }

        const territoryIds = territories.map(t => t.id);

        // 2. Busca todos os endereços ATIVOS para estes territórios para contar em memória
        const { data: addresses, error: aErr } = await supabaseAdmin
            .from('addresses')
            .select('territory_id, gender')
            .in('territory_id', territoryIds)
            .eq('is_active', true);

        if (aErr) throw aErr;

        // 3. Agrega as estatísticas
        const statsMap: Record<string, { count: number, men: number, women: number, couples: number }> = {};

        addresses?.forEach(addr => {
            if (!statsMap[addr.territory_id]) {
                statsMap[addr.territory_id] = { count: 0, men: 0, women: 0, couples: 0 };
            }
            statsMap[addr.territory_id].count++;
            if (addr.gender === 'HOMEM') statsMap[addr.territory_id].men++;
            else if (addr.gender === 'MULHER') statsMap[addr.territory_id].women++;
            else if (addr.gender === 'CASAL') statsMap[addr.territory_id].couples++;
        });

        // 4. Formata o retorno
        const formattedTerritories = territories.map(t => {
            const stats = statsMap[t.id] || { count: 0, men: 0, women: 0, couples: 0 };
            return {
                ...t,
                addressCount: stats.count,
                menCount: stats.men,
                womenCount: stats.women,
                couplesCount: stats.couples
            };
        });

        return NextResponse.json({ success: true, territories: formattedTerritories });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
