import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
    console.log("Testing insert with links...");
    const { error } = await supabase.from('witnessing_points').insert({
        name: 'Test Point',
        address: 'Test Address',
        city_id: '00000000-0000-0000-0000-000000000000',
        google_maps_link: 'http://test',
        waze_link: 'http://test'
    });
    if (error) {
        console.log("HAS_ERROR: true");
        console.log("ERROR_MSG:", error.message);
    } else {
        console.log("HAS_ERROR: false");
    }
}

testInsert();
