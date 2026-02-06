
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

const CAMPAIGN_ID = '7aa67af1-199c-41eb-96d4-12a5c36b116b';
const USER_ID = 'LOSER';

async function debugCollection() {
    console.log(`Calling collect-coupon for ${USER_ID} on ${CAMPAIGN_ID}...`);

    // We use the public function URL (or local if configured, but let's try public/VITE url first)
    const functionUrl = `${supabaseUrl}/functions/v1/collect-coupon`;
    console.log('Function URL:', functionUrl);

    try {
        const res = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`
            },
            body: JSON.stringify({
                userId: USER_ID,
                campaignId: CAMPAIGN_ID,
                secretCode: ''
            })
        });

        const status = res.status;
        const text = await res.text();

        console.log(`Response Status: ${status}`);
        console.log(`Response Body: ${text}`);

        try {
            const json = JSON.parse(text);
            if (json.error) {
                console.error('API Error:', json.error);
            } else {
                console.log('Success:', json);
            }
        } catch (e) {
            console.error('Failed to parse JSON response');
        }

    } catch (err) {
        console.error('Fetch error:', err);
    }
}

debugCollection();
