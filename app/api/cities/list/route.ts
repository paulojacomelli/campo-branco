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
        let congregationId = url.searchParams.get('congregationId');

        // Tenta buscar o perfil do usuário
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
        if (adminData?.role !== 'ADMIN' || !congregationId) {
            congregationId = adminData?.congregation_id || null;
        }

        const isAllowed = adminData && (
            adminData.role === 'ADMIN' ||
            (['ELDER', 'SERVANT', 'ADMIN', 'ANCIAO', 'SERVO'].includes(adminData.role || ''))
        );

        if (!isAllowed || !congregationId) {
            return NextResponse.json({ error: 'Você não tem acesso a essa congregação' }, { status: 403 });
        }

        // Usa o supabaseAdmin (Service Key) para forçar o bypass do RLS para Select
        const { data: cities, error: tErr } = await supabaseAdmin
            .from('cities')
            .select('*')
            .eq('congregation_id', congregationId)
            .order('name');

        if (tErr) throw tErr;

        return NextResponse.json({ success: true, cities });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
