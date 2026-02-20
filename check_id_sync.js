require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

async function checkIdSync() {
    console.log("Checking ID sync between public.users and auth.users...");

    const { data: dbUsers } = await supabaseAdmin.from('users').select('id, name, email');
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();

    dbUsers.forEach(dbU => {
        const matchingAuth = authUsers.find(au => au.id === dbU.id);
        console.log(`User: ${dbU.name}`);
        console.log(`- ID: ${dbU.id}`);
        console.log(`- In Auth? ${!!matchingAuth}`);
        if (matchingAuth) {
            console.log(`- Auth Email: ${matchingAuth.email}`);
        }
        console.log("---");
    });
}
checkIdSync();
