const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data: cities, error } = await supabase.from('cities').select('*');
    if (error) {
        console.error("Error fetching cities:", error);
    } else {
        console.log(`Cities in DB:`);
        console.log(JSON.stringify(cities.map(c => ({ id: c.id, name: c.name, cong_id: c.congregation_id })), null, 2));
    }
}
run();
