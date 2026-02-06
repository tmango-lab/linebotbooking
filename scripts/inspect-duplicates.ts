
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CAMPAIGN_ID = '7aa67af1-199c-41eb-96d4-12a5c36b116b';
const USER_ID = 'WINNER';

async function inspectDuplicates() {
    console.log(`Inspecting Coupons for ${USER_ID} on Campaign ${CAMPAIGN_ID}`);

    const { data: coupons, error } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('campaign_id', CAMPAIGN_ID);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${coupons?.length} coupons:`);
    coupons?.forEach(c => {
        console.log(`- ID: ${c.id}, Status: ${c.status}, Created: ${c.created_at}`);
    });
}

inspectDuplicates();
