
import { createClient } from '@supabase/supabase-js';

// Load keys (assuming dotenv preloaded or standard env)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Fix: Check VITE_ prefix for service role key too
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase URL or Service Role Key');
    console.error('Keys found:', {
        url: !!supabaseUrl,
        key: !!supabaseServiceKey
    });
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupPaKao() {
    console.log('Creating Pa-Kao Secret Campaign... 👵');
    const secretCode = 'ป้าขาว';

    // 1. Check if exists
    const { data: existing, error: findError } = await supabase
        .from('campaigns')
        .select('id')
        .contains('secret_codes', [secretCode])
        .maybeSingle();

    if (findError) {
        console.error('Error finding campaign:', findError);
        return;
    }

    if (existing) {
        console.log(`✅ Campaign already exists. ID: ${existing.id}`);
        return;
    }

    // 2. Create Campaign
    // Note: Removed 'description' to avoid stale schema cache issues (PGRST204)
    const { data, error } = await supabase
        .from('campaigns')
        .insert({
            name: 'โปรป้าขาวใจดี',
            coupon_type: 'ONTOP',
            benefit_type: 'DISCOUNT',
            benefit_value: { percent: 50 },
            secret_codes: [secretCode, 'PAKAO'],
            is_public: false,
            total_quantity: 100,
            remaining_quantity: 100,
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            image_url: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop'
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating campaign:', error);
    } else {
        console.log('✅ Campaign Created Successfully!');
        console.log(`ID: ${data.id}`);
    }
}

setupPaKao();
