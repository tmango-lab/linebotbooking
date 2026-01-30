
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
try {
    const envPath = path.resolve(__dirname, '../.env');
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('Could not load .env file, using process.env');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
            secret_codes: [secretCode, 'PAKAO'], // Multi-code support
            is_public: false, // Hidden from normal list
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
        console.log(`Secret Codes: ${data.secret_codes.join(', ')}`);
    }
}

setupPaKao();
