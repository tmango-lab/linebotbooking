
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
// Use Service Role to allow inserting into campaigns
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedCampaign() {
    console.log('Seeding Campaign...');

    // Check if exists
    const { data: existing } = await supabase
        .from('campaigns')
        .select('id')
        .eq('id', '7aa67af1-199c-41eb-96d4-12a5c36b116b')
        .single();

    if (existing) {
        console.log('Campaign already exists.');
        return;
    }

    const { error } = await supabase
        .from('campaigns')
        .insert({
            id: '7aa67af1-199c-41eb-96d4-12a5c36b116b',
            name: 'QR TEST REDEMTION LIMIT',
            description: 'Test Campaign for QR Limit',
            status: 'active',
            is_public: true,
            start_date: '2026-02-05T00:00:00+00:00',
            end_date: '2026-03-07T00:00:00+00:00',
            limit_per_user: 1,
            redemption_limit: 2,
            redemption_count: 0,
            payment_methods: ['QR'],
            discount_type: 'fixed',
            discount_value: 100
        });

    if (error) {
        console.error('Error seeding campaign:', error);
    } else {
        console.log('✅ Campaign seeded successfully.');
    }
}

seedCampaign();
