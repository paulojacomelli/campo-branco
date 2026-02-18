
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Note: Client-side operations use anon key, but usually RLS protects sensitive actions.
// If I need to act as admin/service_role to bypass RLS for diagnostics, I'd need SERVICE_ROLE_KEY.
// But we want to simulate USER behavior, so anon key + auth token is needed.
// Since I can't easily get a user token here without login flow, maybe I should check RLS definitions directly if possible?
// Or use service_role to check if delete WORKS at all (ruling out FK constraints).

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Listing congregations...');
    const { data: congregs, error: listError } = await supabase
        .from('congregations')
        .select('id, name')
        .limit(5);

    if (listError) {
        console.error('Error listing:', listError);
        return;
    }

    console.log('Congregations found:', congregs);
}

test();
