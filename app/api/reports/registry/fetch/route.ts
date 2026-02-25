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

        // Get user's congregation and role from profile
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id')
            .eq('id', user.id)
            .single();

        const { searchParams } = new URL(req.url);
        let congregationId = searchParams.get('congregationId');

        // Force congregationId to be the user's congregation for non-superadmins
        // Or if the user is a superadmin but we want to stick to their own for operational views
        if (profile?.role !== 'ADMIN' || !congregationId) {
            congregationId = profile?.congregation_id || null;
        }

        if (!congregationId) {
            return NextResponse.json({ error: 'Congregacão não identificada' }, { status: 400 });
        }

        // Fetch Territories
        const { data: territories, error: terrError } = await supabaseAdmin
            .from('territories')
            .select('*')
            .eq('congregation_id', congregationId);

        if (terrError) throw terrError;

        // Fetch Cities
        const { data: cities, error: cityError } = await supabaseAdmin
            .from('cities')
            .select('*')
            .eq('congregation_id', congregationId);

        if (cityError) throw cityError;

        // Fetch Shared Lists (History)
        const { data: sharedLists, error: listError } = await supabaseAdmin
            .from('shared_lists')
            .select('*')
            .eq('congregation_id', congregationId);

        if (listError) throw listError;

        return NextResponse.json({
            territories: territories || [],
            cities: cities || [],
            sharedLists: sharedLists || []
        });
    } catch (error: any) {
        console.error("Registry Fetch API Error:", error);
        return NextResponse.json({
            error: error.message || 'Erro interno no servidor'
        }, { status: 500 });
    }
}
