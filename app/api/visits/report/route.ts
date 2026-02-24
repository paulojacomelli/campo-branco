import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { visitData, shareId } = body;

        if (!shareId || !visitData) {
            return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
        }

        // 1. Verify that the shared list exists and is not expired
        const { data: list, error: listError } = await supabaseAdmin
            .from('shared_lists')
            .select('expires_at, congregation_id')
            .eq('id', shareId)
            .single();

        if (listError || !list) {
            return NextResponse.json({ error: 'Link de compartilhamento inválido' }, { status: 403 });
        }

        if (list.expires_at) {
            const now = new Date();
            const expires = new Date(list.expires_at);
            if (now > expires) {
                return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
            }
        }

        // 2. Insert the visit using admin client
        // Ensure the congregation_id matches the list's congregation
        const finalVisitData = {
            ...visitData,
            shared_list_id: shareId,
            congregation_id: list.congregation_id
        };

        const { data: insertedVisit, error: insertError } = await supabaseAdmin
            .from('visits')
            .insert(finalVisitData)
            .select()
            .single();

        if (insertError) {
            console.error("[VISIT REPORT API] Insert error:", insertError);
            throw insertError;
        }

        // 3. (Removido) Inativação automática revertida em favor de aprovação manual por admins


        return NextResponse.json({ success: true, visit: insertedVisit });

    } catch (error: any) {
        console.error("Critical Error in /api/visits/report:", error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
