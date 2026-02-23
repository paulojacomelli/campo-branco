import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID do link ausente' }, { status: 400 });
        }

        // 1. Fetch Shared List Metadata
        const { data: list, error: listError } = await supabaseAdmin
            .from('shared_lists')
            .select('*')
            .eq('id', id)
            .single();

        if (listError || !list) {
            console.warn(`[SHARE API] Link not found: ${id}`);
            return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
        }

        // 2. Check Expiration
        if (list.expires_at) {
            const now = new Date();
            const expires = new Date(list.expires_at);
            if (now > expires) {
                return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
            }
        }

        // 3. Fetch Snapshots (Territories/Addresses data)
        const { data: snapshots, error: snapError } = await supabaseAdmin
            .from('shared_list_snapshots')
            .select('item_id, data')
            .eq('shared_list_id', id);

        if (snapError) {
            console.error(`[SHARE API] snapshot error:`, snapError);
        }

        // 4. Fetch Visits
        const { data: visits, error: visitsError } = await supabaseAdmin
            .from('visits')
            .select('*')
            .eq('shared_list_id', id);

        if (visitsError) {
            console.error(`[SHARE API] visits error:`, visitsError);
        }

        // 5. Fetch Congregation Details (Category)
        let congregationCategory = 'TRADITIONAL';
        if (list.congregation_id) {
            const { data: congData } = await supabaseAdmin
                .from('congregations')
                .select('category')
                .eq('id', list.congregation_id)
                .single();
            if (congData) congregationCategory = congData.category;
        }

        // 6. Consolidate results
        // Use snapshots to reconstruct items if possible
        let items: any[] = [];
        if (snapshots && snapshots.length > 0) {
            // Map snapshots back into items. 
            // In creation, we store territories first, then addresses.
            // We can identify them by checking metadata or specific fields
            items = snapshots.map(s => ({
                ...s.data,
                id: s.item_id // Ensure ID is consistent
            }));
        }

        return NextResponse.json({
            success: true,
            list,
            items,
            visits: visits || [],
            congregationCategory
        });

    } catch (error: any) {
        console.error("Critical Error in /api/shared_lists/get:", error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
