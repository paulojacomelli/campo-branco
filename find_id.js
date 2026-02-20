
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const targetId = 'c8f701ac-056a-48d6-abef-ed1cd1f2a970';

async function findId() {
    console.log(`--- Searching for ID: ${targetId} ---`);
    const { data, error } = await supabase
        .from('shared_lists')
        .select('id, title, created_at')
        .eq('id', targetId);

    if (error) {
        console.error("Error:", error.message);
    } else if (data.length === 0) {
        console.log("ID NOT FOUND.");

        // Let's check if it exists in another table by mistake?
        console.log("Checking shared_list_snapshots...");
        const { count } = await supabase
            .from('shared_list_snapshots')
            .select('*', { count: 'exact', head: true })
            .eq('shared_list_id', targetId);
        console.log(`Snapshot count for this ID: ${count || 0}`);
    } else {
        console.log("Found:", data[0]);
    }
}

findId();
