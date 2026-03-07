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

async function fixOldCoupons() {
    const userId = 'Ua636ab14081b483636896549d2026398';

    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log('Fixing NULL expires_at...');
    const { data, error } = await supabase
        .from('user_coupons')
        .update({ expires_at: defaultExpiry })
        .is('expires_at', null)
        .select();

    if (error) {
        console.error('Error updating:', error);
    } else {
        console.log(`Updated ${data.length} coupons to have expires_at=${defaultExpiry}`);
    }
}

fixOldCoupons();
