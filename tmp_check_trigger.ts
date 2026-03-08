import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrigger() {
    const { data, error } = await supabase.rpc('get_trigger_def', { trigger_name: 'assign_points_on_payment' });
    console.log('Trigger:', data, error);
}

// Fallback if rpc is not there, we can look at check_pg_triggers.cjs
checkTrigger().catch(console.error);
