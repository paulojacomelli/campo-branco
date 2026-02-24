import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

/**
 * Endpoint para remover uma visita registrada via link compartilhado.
 * Remove APENAS as visitas associadas àquele link específico e endereço.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { addressId, shareId } = body;

        if (!addressId || !shareId) {
            return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
        }

        // 1. Verificar se o link de compartilhamento existe
        const { data: list, error: listError } = await supabaseAdmin
            .from('shared_lists')
            .select('id')
            .eq('id', shareId)
            .single();

        if (listError || !list) {
            return NextResponse.json({ error: 'Link de compartilhamento inválido' }, { status: 403 });
        }

        // 2. Remover a(s) visita(s) associada(s)
        // Filtramos por address_id e shared_list_id para garantir que não removemos o histórico global do endereço
        const { error: deleteError } = await supabaseAdmin
            .from('visits')
            .delete()
            .eq('address_id', addressId)
            .eq('shared_list_id', shareId);

        if (deleteError) {
            console.error("[VISIT DELETE API] Delete error:", deleteError);
            throw deleteError;
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Critical Error in /api/visits/delete:", error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
