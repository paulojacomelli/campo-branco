import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        let congregationId = searchParams.get('congregationId');
        const territoryId = searchParams.get('territoryId');

        if (!territoryId) {
            return NextResponse.json({ error: 'ID do território não fornecido' }, { status: 400 });
        }

        // Get user profile for verification
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id')
            .eq('id', user.id)
            .single();

        // Security: Ensure congregationId matches the user's congregation
        if (profile?.role !== 'SUPER_ADMIN' || !congregationId) {
            congregationId = profile?.congregation_id || null;
        }

        if (!congregationId) {
            return NextResponse.json({ error: 'Congregacão não identificada' }, { status: 400 });
        }

        // Query shared_lists where the items array contains this territoryId
        const { data, error } = await supabaseAdmin
            .from('shared_lists')
            .select('*')
            .eq('congregation_id', congregationId)
            .contains('items', [territoryId])
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data: data || [] });
    } catch (error: any) {
        console.error("Territory History API Error:", error);
        return NextResponse.json({
            error: error.message || 'Erro interno no servidor'
        }, { status: 500 });
    }
}
