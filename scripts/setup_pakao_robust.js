
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Manually Parse .env (Robust & Zero Dep)
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env');
        if (!fs.existsSync(envPath)) return {};
        const content = fs.readFileSync(envPath, 'utf-8');
        const env = {};
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                let value = match[2].trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                env[match[1]] = value;
            }
        });
        return env;
    } catch (e) {
        console.warn('Failed to load .env manually:', e);
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase URL or Service Role Key.');
    console.log('Please ensure .env file exists in project root with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupPaKao() {
    console.log('Creating Pa-Kao Secret Campaign... 👵');

    const secretCode = 'ป้าขาว';

    // 1. Check if exists
    const { data: existing, error: checkError } = await supabase
        .from('campaigns')
        .select('id')
        .contains('secret_codes', [secretCode])
        .maybeSingle();

    if (checkError) {
        console.error('Error checking campaign:', checkError);
        return;
    }

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
