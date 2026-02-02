
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserCoupons() {
    const userId = 'Ua636ab14081b483636896549d2026398';
    console.log(`--- Checking Coupons for User: ${userId} ---`);

    const { data: coupons, error } = await supabase
        .from('user_coupons')
        .select(`
            *,
            campaign:campaigns (name)
        `)
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching coupons:', error);
        return;
    }

    console.log(`Found ${coupons.length} coupons.`);

    coupons.forEach(c => {
        console.log(`- ID: ${c.id}`);
        console.log(`  Campaign: ${c.campaign?.name}`);
        console.log(`  Status: ${c.status}`);
        console.log(`  Expires: ${c.expires_at}`);
        console.log(`  Created: ${c.created_at}`);
        console.log('-----------------------------------');
    });

    if (coupons.length === 0) {
        console.log('❌ No coupons found. Trying partial match...');
        const { data: allCoupons } = await supabase.from('user_coupons').select('user_id').limit(5);
        console.log('Sample UserIDs in DB:', allCoupons.map(c => c.user_id));
    }
}

checkUserCoupons();
