import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { listData, territories } = body;

        // 1. Insert into shared_lists using Supabase Admin to bypass RLS
        const { data: shareData, error: shareError } = await supabaseAdmin
            .from('shared_lists')
            .insert(listData)
            .select()
            .single();

        if (shareError) {
            console.error("Error creating shared list:", shareError);
            throw shareError;
        }

        // 2. Create snapshots (Territories + Addresses in one go using supabaseAdmin)
        const snapshotEntries = [];

        // Snapshot Territories
        if (territories && Array.isArray(territories)) {
            for (const t of territories) {
                snapshotEntries.push({
                    shared_list_id: shareData.id,
                    item_id: t.id,
                    data: t
                });
            }

            // Snapshot Addresses
            const territoryIds = territories.map((t: any) => t.id);
            const { data: addresses, error: addrError } = await supabaseAdmin
                .from('addresses')
                .select('*')
                .in('territory_id', territoryIds);

            if (addresses && !addrError) {
                for (const addr of addresses) {
                    snapshotEntries.push({
                        shared_list_id: shareData.id,
                        item_id: addr.id,
                        data: addr
                    });
                }
            }

            if (snapshotEntries.length > 0) {
                const { error: snapError } = await supabaseAdmin
                    .from('shared_list_snapshots')
                    .insert(snapshotEntries);

                if (snapError) console.warn("[SNAPSHOT] Failed to save snapshots:", snapError);
            }
        }

        return NextResponse.json({ shareData });
    } catch (error: any) {
        console.error("Shared List API Error:", error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
