
import { createClient } from 'npm:@supabase/supabase-js@2';
import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

// Load env
const env = config({ path: "../.env" });
const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || env.VITE_SUPABASE_URL || Deno.env.get("SUPABASE_URL") || env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase URL or Service Role Key");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupPaKao() {
    console.log('Creating Pa-Kao Secret Campaign... 👵');

    const secretCode = 'ป้าขาว';

    // 1. Check if exists
    const { data: existing } = await supabase
        .from('campaigns')
        .select('id')
        .contains('secret_codes', [secretCode])
        .maybeSingle();

    if (existing) {
        console.log(`Campaign with code "${secretCode}" already exists. ID: ${existing.id}`);
        return;
    }

    // 2. Create Campaign
    const { data, error } = await supabase
        .from('campaigns')
        .insert({
            name: 'โปรป้าขาวใจดี',
            description: 'ส่วนลดพิเศษสำหรับหลานๆ ที่รู้รหัสลับจากป้าขาว ลดทันที 50%!',
            coupon_type: 'ONTOP',
            benefit_type: 'DISCOUNT',
            benefit_value: { percent: 50 },
            secret_codes: [secretCode, 'PAKAO'],
            is_public: false,
            total_quantity: 100,
            remaining_quantity: 100,
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days
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
