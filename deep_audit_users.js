require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deepAudit() {
    const cid = 'ls-catanduva';
    console.log(`--- Audit for Congregation: ${cid} ---`);

    // 1. Get all public users for this CID
    const { data: dbUsers, error: dbErr } = await supabaseAdmin.from('users').select('*').eq('congregation_id', cid);
    if (dbErr) { console.error("DB Error:", dbErr); return; }
    console.log(`Public Users (${dbUsers.length}):`);
    dbUsers.forEach(u => console.log(` - ${u.name} | ID: ${u.id} | Email: ${u.email}`));

    // 2. Get all Auth users
    const { data: { users: authUsers }, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
    if (authErr) { console.error("Auth Error:", authErr); return; }
    console.log(`\nAuth Users total count: ${authUsers.length}`);

    // 3. Match check
    console.log("\nMatching Logic Check:");
    dbUsers.forEach(dbU => {
        const match = authUsers.find(au => au.id === dbU.id);
        console.log(` - ${dbU.name}: ${match ? 'MATCHED' : 'MISSING IN AUTH'}`);
        if (match) {
            const avatar = match.user_metadata?.avatar_url || match.user_metadata?.picture;
            console.log(`   Avatar: ${avatar || 'N/A'}`);
        }
    });
}
deepAudit();
