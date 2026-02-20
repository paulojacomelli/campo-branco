require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTerritories() {
    console.log("Checking territories for congregation_id...");
    const { data: territories, error } = await supabase
        .from('territories')
        .select('id, name, congregation_id')
        .limit(10);

    if (error) {
        console.error("Error:", error);
    } else {
        territories.forEach(t => {
            console.log(`Territory: ${t.name} (ID: ${t.id})`);
            console.log(`- congregation_id: ${t.congregation_id}`);
            console.log("---");
        });
    }
}
checkTerritories();
