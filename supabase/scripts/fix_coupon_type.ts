import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { console.error('Missing Supabase credentials'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCouponType() {
    console.log('Updating coupon_type to ontop for reward campaigns...');
    const { data, error } = await supabase
        .from('campaigns')
        .update({ coupon_type: 'ontop' })
        .eq('benefit_type', 'REWARD')
        .like('name', '%Test%')
        .select();

    if (error) console.error(error);
    else console.log(`Updated ${data.length} campaigns to on-top:`, data.map(c => c.name));
}

fixCouponType();
