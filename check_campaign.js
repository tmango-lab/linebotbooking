import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await s
    .from('campaigns')
    .select('id, name, eligible_fields, min_spend, eligible_days, valid_time_start, valid_time_end, status, secret_codes')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5);
if (error) console.error('Error:', error.message);
else console.log(JSON.stringify(data, null, 2));
process.exit(0);
