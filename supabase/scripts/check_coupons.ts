import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCoupons() {
    const userId = 'Ua636ab14081b483636896549d2026398';

    console.log('Fetching coupons for user:', userId);
    const { data, error } = await supabase
        .from('user_coupons')
        .select(`
      id,
      status,
      expires_at,
      campaign_id,
      campaign:campaigns (
        id,
        name,
        coupon_type,
        benefit_type
      )
    `)
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching coupons:', error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

checkCoupons();
