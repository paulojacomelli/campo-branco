require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function auditIds() {
    console.log("--- ID Audit ---");

    // 1. Get the user
    const email = 'paulo.jacomelli2001@gmail.com';
    const { data: userData } = await supabaseAdmin.from('users').select('*').eq('email', email).single();
    console.log(`User: ${userData.name} | Congregation: ${userData.congregation_id}`);

    // 2. Get the territory we saw earlier
    const tId = '68df97ed-0c2f-498c-b875-0ae0f0492281';
    const { data: tData } = await supabaseAdmin.from('territories').select('*').eq('id', tId).single();
    if (tData) {
        console.log(`Territory ${tData.name} | Congregation: ${tData.congregation_id}`);
    } else {
        console.log(`Territory ${tId} NOT FOUND.`);
    }

    // 3. List all territories
    const { data: allT } = await supabaseAdmin.from('territories').select('id, name, congregation_id');
    console.log(`Total territories in DB: ${allT?.length}`);
    allT?.forEach(t => console.log(` - ${t.name} (ID: ${t.id}) | CID: ${t.congregation_id}`));
}

auditIds();
