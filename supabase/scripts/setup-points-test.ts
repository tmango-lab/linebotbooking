import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTestData() {
    const userId = 'Ua636ab14081b483636896549d2026398';

    // 1. Give Points to User
    console.log('Adding 2000 points to user:', userId);
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ points: 2000 })
        .eq('user_id', userId);

    if (profileError) {
        console.error('Error updating points:', profileError);
        return;
    }

    // Also add a history record so it looks real
    const { error: historyError } = await supabase
        .from('point_history')
        .insert([
            {
                user_id: userId,
                amount: 1000,
                transaction_type: 'MANUAL_ADJUST',
                description: 'คะแนนเทสระบบโอนให้พิเศษ สำหรับเทสแลกคูปอง',
                balance_after: 2000
            }
        ]);

    if (historyError) {
        console.error('Error adding point history:', historyError);
    }

    // 2. Create 3 Test Campaigns that require points
    console.log('Creating 3 test campaigns...');
    const testCampaigns = [
        {
            name: 'Test แลกน้ำ 1 ขวด (ใช้ 100 แต้ม)',
            description: 'โชว์ให้หน้าเคาน์เตอร์เพื่อรับน้ำ 1 ขวด',
            point_cost: 100,
            benefit_type: 'REWARD',
            benefit_value: { item: 'น้ำดื่ม 1 ขวด' },
            status: 'active',
            is_public: true,
            limit_per_user: 5,
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            total_quantity: 100,
            remaining_quantity: 100,
            is_stackable: true
        },
        {
            name: 'Test ส่วนลด 50 บาท (ใช้ 200 แต้ม)',
            description: 'คูปองส่วนลด 50 บาทสำหรับการจองครั้งถัดไป',
            point_cost: 200,
            benefit_type: 'DISCOUNT',
            benefit_value: { amount: 50 },
            status: 'active',
            is_public: true,
            limit_per_user: 2,
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            total_quantity: 50,
            remaining_quantity: 50,
            is_stackable: false
        },
        {
            name: 'Test ลด 50% (ใช้ 500 แต้ม)',
            description: 'ส่วนลด 50% สูงสุด 500 บาท',
            point_cost: 500,
            benefit_type: 'DISCOUNT',
            benefit_value: { percent: 50, max_discount: 500 },
            status: 'active',
            is_public: true,
            limit_per_user: 1,
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            total_quantity: 10,
            remaining_quantity: 10,
            is_stackable: false
        }
    ];

    const { data, error: campaignError } = await supabase
        .from('campaigns')
        .insert(testCampaigns)
        .select();

    if (campaignError) {
        console.error('Error creating campaigns:', campaignError);
    } else {
        console.log('Created campaigns successfully:', data?.map(c => c.id));
    }
}

setupTestData();
