import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testJoin() {
    console.log("--- Testing Territories joins ---");
    const { error: e1 } = await supabase.from('territories').select('id, cities(name)').limit(1);
    console.log("cities:", e1 ? e1.message : "OK");

    const { error: e2 } = await supabase.from('territories').select('id, city(name)').limit(1);
    console.log("city:", e2 ? e2.message : "OK");

    console.log("\n--- Testing Visits joins ---");
    const { error: e3 } = await supabase.from('visits').select('id, addresses(street)').limit(1);
    console.log("addresses:", e3 ? e3.message : "OK");

    const { error: e4 } = await supabase.from('visits').select('id, address(street)').limit(1);
    console.log("address:", e4 ? e4.message : "OK");

    const { error: e5 } = await supabase.from('visits').select('id, users(name)').limit(1);
    console.log("users:", e5 ? e5.message : "OK");

    const { error: e6 } = await supabase.from('visits').select('id, user(name)').limit(1);
    console.log("user:", e6 ? e6.message : "OK");

    // Sometimes it's the FK column name
    const { error: e7 } = await supabase.from('territories').select('id, city_id(name)').limit(1);
    console.log("city_id join:", e7 ? e7.message : "OK");
}

testJoin();
