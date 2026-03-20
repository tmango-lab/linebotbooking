
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLatestBooking() {
    console.log('--- Inspecting Latest Booking ---');

    // 1. Get Latest Booking
    const { data: bookings, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (bookingError) {
        console.error('Error fetching booking:', bookingError);
        return;
    }

    if (!bookings || bookings.length === 0) {
        console.log('No bookings found.');
        return;
    }

    const booking = bookings[0];
    console.log('Latest Booking:', {
        id: booking.id,
        booking_id: booking.booking_id,
        customer: booking.display_name,
        is_promo: booking.is_promo,
        price: booking.price_total_thb,
        created_at: booking.created_at
    });

    // 2. Check Linked Coupons
    console.log(`Checking user_coupons for booking_id: ${booking.booking_id}`);

    const { data: coupons, error: couponError } = await supabase
        .from('user_coupons')
        .select('id, status, booking_id, campaigns(name, reward_item)')
        .eq('booking_id', booking.booking_id);

    if (couponError) {
        console.error('Error fetching coupons:', couponError);
    } else {
        console.log('Linked Coupons:', coupons);
    }

    // 3. Check Coupons manually by searching for RECENTLY USED coupons (in case link failed)
    const { data: recentCoupons } = await supabase
        .from('user_coupons')
        .select('id, coupon_code, status, booking_id, used_at')
        .eq('status', 'USED')
        .order('used_at', { ascending: false })
        .limit(5);

    console.log('--- Recent Used Coupons (Any) ---');
    console.table(recentCoupons);
}

inspectLatestBooking();
