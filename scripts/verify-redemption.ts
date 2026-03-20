
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLatestBooking() {
    // 1. Get latest booking
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
        customer: booking.display_name,
        method: booking.payment_method,
        status: booking.status,
        payment_status: booking.payment_status,
        is_promo: booking.is_promo,
        created_at: booking.created_at
    });

    // 2. Check Coupon Usage (if promo)
    // Note: We don't have a direct link in 'bookings' to 'coupon_id' easily visible without parsing admin_note or checking logic, 
    // unless we check user_coupons or campaign_usage tables.
    // Let's check 'user_coupons' for this user.

    if (booking.user_id) {
        const { data: userCoupons, error: ucError } = await supabase
            .from('user_coupons')
            .select('*, campaigns(name, redemption_count, redemption_limit)')
            .eq('user_id', booking.user_id)
            .eq('status', 'USED'); // Assuming it was marked USED

        if (ucError) console.error('Error fetching user coupons:', ucError);
        else {
            console.log('Used Coupons for User:', userCoupons);
        }
    }
}

checkLatestBooking();
