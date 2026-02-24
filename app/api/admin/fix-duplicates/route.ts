import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const url = new URL(req.url);
        const congregationId = url.searchParams.get('congregationId');

        if (!congregationId) {
            return NextResponse.json({ error: 'Congregacão não informada' }, { status: 400 });
        }

        // 1. Fetch all territories for this congregation
        const { data: territories, error: tErr } = await supabaseAdmin
            .from('territories')
            .select('id, name, city_id')
            .eq('congregation_id', congregationId);

        if (tErr) throw tErr;
        if (!territories) return NextResponse.json({ success: true, merged: 0 });

        const stats = { found: 0, merged: 0, errors: [] as string[] };
        const territoriesByCity: Record<string, typeof territories> = {};

        territories.forEach(t => {
            if (!territoriesByCity[t.city_id]) territoriesByCity[t.city_id] = [];
            territoriesByCity[t.city_id].push(t);
        });

        for (const [cityId, cityTerrs] of Object.entries(territoriesByCity)) {
            for (const t of cityTerrs) {
                const name = t.name.trim();
                // Check if it's a single digit (e.g., "1")
                if (/^\d+$/.test(name) && name.length === 1) {
                    const normalizedName = name.padStart(2, '0'); // "01"
                    const target = cityTerrs.find(targetT => targetT.name === normalizedName);

                    if (target && target.id !== t.id) {
                        stats.found++;
                        try {
                            // 2. Move addresses from source (t.id) to target (target.id)
                            const { error: moveErr } = await supabaseAdmin
                                .from('addresses')
                                .update({ territory_id: target.id })
                                .eq('territory_id', t.id);

                            if (moveErr) throw moveErr;

                            // 3. Delete source territory
                            const { error: delErr } = await supabaseAdmin
                                .from('territories')
                                .delete()
                                .eq('id', t.id);

                            if (delErr) throw delErr;

                            stats.merged++;
                        } catch (err: any) {
                            stats.errors.push(`Erro mesclando ${name} -> ${normalizedName}: ${err.message}`);
                        }
                    }
                }
            }
        }

        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
