import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const url = new URL(req.url);
        const congregation_id = url.searchParams.get('congregationId');

        if (!congregation_id) {
            return NextResponse.json({ error: 'ID da congregação ausente' }, { status: 400 });
        }

        // Get members from public.users table
        const { data: dbUsers, error: dbError } = await supabaseAdmin
            .from('users')
            .select('id, name, email')
            .eq('congregation_id', congregation_id)
            .order('name', { ascending: true });

        if (dbError) throw dbError;

        // Fetch auth users to get avatar_url from metadata
        const { data: { users: authUsers }, error: authListError } = await supabaseAdmin.auth.admin.listUsers();

        if (authListError) {
            console.error("Auth list error:", authListError);
            // Non-blocking but good to know
        }

        const usersWithAvatars = (dbUsers || []).map(dbUser => {
            const authUser = authUsers?.find(au => au.id === dbUser.id);
            return {
                ...dbUser,
                avatar_url: authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null
            };
        });

        // Debug log (server side)
        console.log(`API Found ${dbUsers?.length} public users and mapped ${usersWithAvatars.length} for CID: ${congregation_id}`);

        return NextResponse.json({
            users: usersWithAvatars,
            debug: {
                dbCount: dbUsers?.length,
                authCount: authUsers?.length,
                cid: congregation_id
            }
        });
    } catch (error: any) {
        console.error("List users API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
