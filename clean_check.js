require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanCheck() {
    const cid = 'ls-catanduva';
    console.log(`Checking members for: ${cid}`);
    const { data } = await supabaseAdmin.from('users').select('name, email').eq('congregation_id', cid);
    console.log("Found:", JSON.stringify(data, null, 2));
}
cleanCheck();
