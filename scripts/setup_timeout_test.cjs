
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTimeout() {
    const campaignId = '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c';
    const userId = 'TIMEOUT_USER';

    console.log('--- Setting up Timeout Test ---');

    // 1. Free up a slot by cancelling M4 (if confirmed)
    // We search for M4's confirmed booking
    const { data: m4Booking } = await supabase
        .from('bookings')
        .select('booking_id')
        .eq('user_id', 'M4')
        .eq('status', 'confirmed')
        .maybeSingle();

    if (m4Booking) {
        console.log(`Cancelling M4 booking (${m4Booking.booking_id}) to free up slot...`);
        await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('booking_id', m4Booking.booking_id);

        // Decrement campaign count
        await supabase.rpc('decrement_campaign_redemption', { target_campaign_id: campaignId });
        console.log('Slot freed.');
    } else {
        console.log('M4 booking not confirmed or already cancelled. Assuming slot is available (checking needs logic but proceeding for test).');
    }

    // 2. Create/Reset Coupon for TIMEOUT_USER
    console.log('Creating/Resetting Coupon for TIMEOUT_USER...');
    // Delete existing to be clean
    await supabase.from('user_coupons').delete().eq('user_id', userId);

    // Insert new ACTIVE coupon
    const { data: coupon, error: cErr } = await supabase.from('user_coupons').insert({
        user_id: userId,
        campaign_id: campaignId,
        status: 'ACTIVE'
    }).select().single();

    if (cErr) { console.error('Error creating coupon:', cErr); return; }

    // 3. Create Expired Booking
    const bookingId = Date.now().toString() + '_TIMEOUT';
    const tenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 mins ago

    console.log(`Creating expired booking ${bookingId} with timeout_at: ${tenMinsAgo}`);
    const { error: bErr } = await supabase.from('bookings').insert({
        booking_id: bookingId,
        user_id: userId,
        display_name: 'TIMEOUT_TESTER',
        field_no: 1,
        date: '2026-02-28',
        time_from: '18:00:00',
        time_to: '19:00:00',
        duration_h: 1,
        price_total_thb: 350,
        payment_status: 'pending',
        status: 'pending_payment',
        is_promo: true,
        timeout_at: tenMinsAgo // EXPIRED!
    });

    if (bErr) { console.error('Error creating booking:', bErr); return; }

    // 4. Link Coupon (Simulate "USED" / locked state)
    console.log('Linking coupon to booking...');
    await supabase.from('user_coupons').update({
        status: 'USED',
        booking_id: bookingId,
        used_at: new Date().toISOString()
    }).eq('id', coupon.id);

    console.log('--- Setup Complete. Waiting for Cron invocation... ---');
}

setupTimeout();
