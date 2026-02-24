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
        const congregationId = url.searchParams.get('congregationId');

        // Permite visualizar se o usuário existir (Bypass RLS check)
        if (!adminData) {
            return NextResponse.json({ error: 'Usuário sem perfil configurado' }, { status: 403 });
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
        // Isso é mais robusto que tentar múltiplos filters em count agregados no PostgREST
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
