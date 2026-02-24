import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Get user profile for verification
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id')
            .eq('id', user.id)
            .single();

        const body = await req.json();
        const { payload, id } = body;

        if (!payload) {
            return NextResponse.json({ error: 'Payload não fornecido' }, { status: 400 });
        }

        // SECURITY: Verify congregationId alignment
        // Non-superadmins MUST save to their own congregation
        if (profile?.role !== 'SUPER_ADMIN') {
            if (payload.congregation_id && payload.congregation_id !== profile?.congregation_id) {
                return NextResponse.json({ error: 'Acesso negado à congregação solicitada' }, { status: 403 });
            }
            // Force it anyway to be safe
            payload.congregation_id = profile?.congregation_id;
        }

        if (id) {
            // Update
            // Check if user is elder/servant or owner if needed, but for now we trust the payload alignment
            const { data, error } = await supabaseAdmin
                .from('shared_lists')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ data });
        } else {
            // Create
            const { data, error } = await supabaseAdmin
                .from('shared_lists')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ data });
        }
    } catch (error: any) {
        console.error("Shared List Save API Error:", error);
        return NextResponse.json({
            error: error.message || 'Erro interno no servidor'
        }, { status: 500 });
    }
}
