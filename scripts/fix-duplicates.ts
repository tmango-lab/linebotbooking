
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
// Service Role required to delete
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CAMPAIGN_ID = '7aa67af1-199c-41eb-96d4-12a5c36b116b';
const USER_ID = 'WINNER';

async function fixDuplicates() {
    console.log(`Fixing duplicates for ${USER_ID}...`);

    // 1. Fetch all
    const { data: coupons } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('campaign_id', CAMPAIGN_ID)
        .order('created_at', { ascending: true }); // Keep oldest?

    if (!coupons || coupons.length <= 1) {
        console.log('No duplicates found.');
        return;
    }

    console.log(`Found ${coupons.length} coupons. Keeping the first one.`);

    // Keep [0], delete the rest
    const toDelete = coupons.slice(1).map(c => c.id);
    console.log('Deleting IDs:', toDelete);

    const { error } = await supabase
        .from('user_coupons')
        .delete()
        .in('id', toDelete);

    if (error) console.error('Delete failed:', error);
    else console.log('Duplicates deleted.');
}

fixDuplicates();
