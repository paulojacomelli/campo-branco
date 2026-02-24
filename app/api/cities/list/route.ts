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
        const congregationId = url.searchParams.get('congregationId');

        // Add auth checking logic (Using Admin to bypass RLS on users table)
        const { data: adminData } = await supabaseAdmin
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        // Permite visualizar se for SUPER_ADMIN ou se a congregationId bater com o registro do usuário
        const userCong = String(adminData?.congregation_id || '').toLowerCase().trim();
        const reqCong = String(congregationId || '').toLowerCase().trim();

        const isAllowed = adminData && (
            adminData.role === 'SUPER_ADMIN' ||
            (userCong === reqCong && (['ELDER', 'SERVANT', 'ADMIN'].includes(adminData.role || '')))
        );

        if (!isAllowed) {
            console.log("Permission denied for user:", currentUser.id, "Requested Cong:", congregationId, "User data:", adminData);
            return NextResponse.json({ error: 'Você não tem acesso a essa congregação' }, { status: 403 });
        }

        // Usa o supabaseAdmin (Service Key) para forçar o bypass do RLS para Select
        const { data: cities, error: tErr } = await supabaseAdmin
            .from('cities')
            .select('*')
            .eq('congregation_id', congregationId)
            .order('name');

        return NextResponse.json({ success: true, cities, error: tErr });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
