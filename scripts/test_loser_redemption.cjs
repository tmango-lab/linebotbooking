
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
    const userId = 'LOSER_ID';
    const displayName = 'LOSER';
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';

    console.log('--- Setting up test for LOSER ---');

    // 1. Ensure LOSER has a coupon
    const { data: existingCoupon } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('user_id', userId)
        .eq('campaign_id', campaignId)
        .single();

    let couponId;
    if (!existingCoupon) {
        console.log('Creating coupon for LOSER...');
        const { data: newCoupon, error: couponError } = await supabase
            .from('user_coupons')
            .insert({
                user_id: userId,
                campaign_id: campaignId,
                status: 'ACTIVE',
                expires_at: '2026-03-08T00:00:00+00:00'
            })
            .select()
            .single();
        if (couponError) {
            console.error('Error creating coupon:', couponError);
            return;
        }
        couponId = newCoupon.id;
    } else {
        console.log('LOSER already has a coupon.');
        couponId = existingCoupon.id;
        // Make sure it's ACTIVE for testing
        await supabase.from('user_coupons').update({ status: 'ACTIVE', booking_id: null, used_at: null }).eq('id', couponId);
    }

    // 2. Create a booking for LOSER
    console.log('Creating booking for LOSER...');
    const bookingId = Date.now().toString() + '_LOSER';
    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
            booking_id: bookingId,
            user_id: userId,
            display_name: displayName,
            field_no: 1,
            date: '2026-02-27',
            time_from: '18:00:00',
            time_to: '19:00:00',
            duration_h: 1,
            price_total_thb: 350, // 400 - 50 discount
            payment_status: 'pending',
            status: 'pending_payment',
            is_promo: true,
            booking_source: 'line'
        })
        .select()
        .single();

    if (bookingError) {
        console.error('Error creating booking:', bookingError);
        return;
    }
    console.log(`Booking created: ${bookingId}`);

    // Link coupon to booking
    await supabase.from('user_coupons').update({ booking_id: bookingId, status: 'USED', used_at: new Date().toISOString() }).eq('id', couponId);
    console.log('Linked coupon to booking.');

    // 3. Simulate Payment (This should trigger increment logic in a real app, 
    // but here we'll manually call the payment simulation logic)
    console.log('Simulating Payment...');

    // In our system, the increment logic is inside simulate-payment.ts or the admin confirmation.
    // Let's use the logic from simulate-payment.ts but specifically for this LOSER booking.

    // Simulate the payment check logic:
    // a. Update booking to confirmed/paid
    const { error: finalUpdateError } = await supabase
        .from('bookings')
        .update({
            status: 'confirmed',
            payment_status: 'paid',
            updated_at: new Date().toISOString()
        })
        .eq('booking_id', bookingId);

    if (finalUpdateError) {
        console.error('Error updating booking:', finalUpdateError);
        return;
    }
    console.log('Booking confirmed and paid.');

    // b. Increment Campaign Redemption (Atomicly)
    const { error: incError } = await supabase.rpc('increment_campaign_redemption', {
        target_campaign_id: campaignId
    });

    if (incError) {
        console.error('Error incrementing campaign:', incError.message);
    } else {
        console.log('Campaign redemption incremented!');
    }

    // 4. Final check
    const { data: finalCampaign } = await supabase
        .from('campaigns')
        .select('redemption_count, redemption_limit')
        .eq('id', campaignId)
        .single();

    console.log(`Final Campaign Status: ${finalCampaign.redemption_count} / ${finalCampaign.redemption_limit}`);
}

setup();
