import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_USER_ID = 'WINNER';

async function simulatePayment() {
    console.log(`🚀 Simulating Payment Confirmation for User: ${TEST_USER_ID}`);

    // 1. Find Most Recent Pending Booking
    console.log('🔍 Searching for the most recent pending booking...');
    const { data: booking, error: bError } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (bError) {
        console.error('❌ Error fetching booking:', bError);
        return;
    }

    if (!booking) {
        console.error('❌ No pending booking found in the system. Please create a booking first!');
        return;
    }

    console.log(`✅ Found Booking: ${booking.booking_id} (User: ${booking.display_name}, Amount: ${booking.price_total_thb} THB)`);

    // 2. Process Redemption (If Promo)
    if (booking.is_promo) {
        console.log('✨ Booking uses a promo. Processing redemption...');
        const { data: coupon, error: cError } = await supabase
            .from('user_coupons')
            .select('*, campaigns!inner(*)')
            .eq('booking_id', booking.booking_id)
            .single();

        if (cError || !coupon) {
            console.error('❌ Error fetching associated coupon:', cError);
        } else {
            const campaign = (coupon as any).campaigns;
            console.log(`📦 Campaign Found: ${campaign.name}`);

            // Increment Redemption Count (Using Atomic RPC)
            console.log('➕ Incrementing redemption count (Atomic)...');
            const { error: incError } = await supabase.rpc('increment_campaign_redemption', {
                target_campaign_id: campaign.id
            });

            if (incError) {
                console.error('❌ Failed to increment redemption:', incError.message);
            } else {
                console.log('✅ Redemption count incremented successfully!');
            }
        }
    }

    // 3. Update Booking Status
    console.log('💾 Updating booking status to CONFIRMED and PAID...');
    const { error: updateError } = await supabase
        .from('bookings')
        .update({
            status: 'confirmed',
            payment_status: 'paid',
            updated_at: new Date().toISOString()
        })
        .eq('booking_id', booking.booking_id);

    if (updateError) {
        console.error('❌ Failed to update booking:', updateError);
    } else {
        console.log('🎉 SUCCESS! Payment simulation complete.');
        console.log('👉 Now check your Admin UI to see the Red text update!');
    }
}

simulatePayment();
