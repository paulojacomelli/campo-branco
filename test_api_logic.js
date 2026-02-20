require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

async function testApiLogic() {
    const congregation_id = 'ls-catanduva'; // From previous inspection
    console.log(`Testing API logic for congregation: ${congregation_id}`);

    // 1. Check public.users
    const { data: dbUsers, error: dbError } = await supabaseAdmin
        .from('users')
        .select('id, name, email')
        .eq('congregation_id', congregation_id);

    if (dbError) {
        console.error("DB Error:", dbError);
        return;
    }
    console.log(`Found ${dbUsers.length} users in public.users:`, dbUsers.map(u => u.name));

    // 2. Check auth.users
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
        console.error("Auth Error:", authError);
        return;
    }
    console.log(`Found ${authUsers.length} total users in Auth.`);

    // 3. Perform Join
    const usersWithAvatars = (dbUsers || []).map(dbUser => {
        const authUser = authUsers?.find(au => au.id === dbUser.id);
        const avatar = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null;
        console.log(`Mapping ${dbUser.name}: Avatar exists? ${!!avatar}`);
        return {
            ...dbUser,
            avatar_url: avatar
        };
    });

    console.log("Final Result Names:", usersWithAvatars.map(u => u.name));
}

testApiLogic();
