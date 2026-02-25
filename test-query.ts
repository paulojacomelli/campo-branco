import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
    console.log("Testing historyQuery...");
    const { data, error } = await supabase.from('shared_lists').select('id, territory_id, created_at, completed_at, returned_at, status').limit(1);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success:", data);
    }
}

testQuery();
