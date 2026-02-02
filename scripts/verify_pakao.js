
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndUpdate() {
    console.log('--- Checking "ป้าขาว" Campaign ---');
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*');

    if (error) {
        console.error('Error fetching campaigns:', error);
        return;
    }

    console.log(`Found ${campaigns.length} campaigns.`);

    let found = false;
    for (const c of campaigns) {
        console.log(`- [${c.id}] Name: ${c.name}, Status: ${c.status}, Codes: ${JSON.stringify(c.secret_codes)}`);
        if (c.secret_codes && c.secret_codes.includes('ป้าขาว')) {
            found = true;
            if (c.status !== 'ACTIVE') {
                console.log(`Updating ${c.name} to ACTIVE...`);
                await supabase.from('campaigns').update({ status: 'ACTIVE' }).eq('id', c.id);
            }
        }
    }

    if (!found) {
        console.log('❌ "ป้าขาว" not found in any secret_codes.');
    } else {
        console.log('✅ "ป้าขาว" campaign is confirmed to be ACTIVE.');
    }
}

checkAndUpdate();
