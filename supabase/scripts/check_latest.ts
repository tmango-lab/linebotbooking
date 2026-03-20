import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { console.error('Missing Supabase credentials'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatest() {
    const userId = 'Ua636ab14081b483636896549d2026398';
    const { data, error } = await supabase
        .from('user_coupons')
        .select('id, status, expires_at, created_at, campaign:campaigns(name, coupon_type)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

checkLatest();
