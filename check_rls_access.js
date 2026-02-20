require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
    console.log("--- RLS Audit for territories ---");
    const { data, error } = await supabaseAdmin.rpc('get_policies', { tablename: 'territories' });

    if (error) {
        // Fallback for checking policies if RPC doesn't exist
        console.log("Checking via direct query to pg_policies...");
        const { data: policies, error: pError } = await supabaseAdmin
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'territories');

        if (pError) {
            console.error("Direct query failed too. Let's try to query public.territories with and without admin.");
        } else {
            console.log("Policies:", policies);
        }
    } else {
        console.log("Policies via RPC:", data);
    }

    // Try reading with Admin (service role) - should always work
    const { count: adminCount } = await supabaseAdmin.from('territories').select('*', { count: 'exact', head: true });
    console.log(`Admin count for territories: ${adminCount}`);

    // Try reading with Anon Key (simulating browser)
    const supabaseAnon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: anonData, error: anonError } = await supabaseAnon.from('territories').select('*').limit(1);
    if (anonError) {
        console.log("Anon Error (expected if RLS is on):", anonError.message);
    } else {
        console.log("Anon succeeded in reading 1 territory? ", !!anonData?.[0]);
    }
}

checkRLS();
