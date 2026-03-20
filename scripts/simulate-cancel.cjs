
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cancel() {
    const bookingId = '1770347334775';
    console.log(`Simulating Admin Cancellation for Booking: ${bookingId}`);

    // RESET TO CONFIRMED FOR TESTING
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('booking_id', bookingId);

    // ALSO RESET COUPON TO 'USED' (Simulation of a paid booking)
    const { error: couponResetError } = await supabase
        .from('user_coupons')
        .update({ status: 'USED', booking_id: bookingId, used_at: new Date().toISOString() })
        .eq('user_id', 'WINNER') // Assuming only one coupon for simplicity or filter by campaign if needed
        .eq('campaign_id', '7dabda04-5e0e-4e1a-a1e0-5c1231723b0c');

    if (couponResetError) console.error('Error resetting coupon:', couponResetError);
    console.log('Reset booking to CONFIRMED and Coupon to USED for testing.');

    // 1. Fetch booking (AGAIN, to get the confirmed status)
    const { data: bookingConfirmed, error: fetchErrorConfirmed } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_id', bookingId)
        .single();

    if (fetchErrorConfirmed || !bookingConfirmed) {
        console.error('Booking not found!');
        return;
    }

    console.log(`Current Booking Status: ${bookingConfirmed.status}`);

    // 2. Simulate Cancellation (Update DB)
    const { error: updateError } = await supabase
        .from('bookings')
        .update({
            status: 'cancelled',
            admin_note: 'Refined Logic Test [Simulated]',
            updated_at: new Date().toISOString()
        })
        .eq('booking_id', bookingId);

    if (updateError) {
        console.error('Error cancelling booking:', updateError);
        return;
    }
    console.log('Booking cancelled in DB.');

    // 3. EXECUTE THE NEW LOGIC (The part we want to verify)
    // Logic: If booking was NOT confirmed, release coupon. Else, keep used.
    let coupons = null;
    if (bookingConfirmed.status !== 'confirmed') {
        console.log('Booking was NOT confirmed. Attempting to release coupon...');
        const { data: releasedCoupons, error: couponError } = await supabase
            .from('user_coupons')
            .update({
                status: 'ACTIVE',
                used_at: null,
                booking_id: null
            })
            .eq('booking_id', bookingId)
            .select('*, campaigns(*)');

        if (couponError) {
            console.error(`Failed to release coupon:`, couponError.message);
        } else {
            coupons = releasedCoupons;
            console.log(`Released coupon for non-confirmed booking: ${bookingId}`);
        }
    } else {
        console.log(`Booking WAS confirmed. NOT releasing coupon (User forfeits right).`);
        // We still need to fetch coupon info to know which campaign to decrement
        const { data: usedCoupons } = await supabase
            .from('user_coupons')
            .select('*, campaigns(*)')
            .eq('booking_id', bookingId);
        coupons = usedCoupons;
    }

    // 4. Decrement Redemption Count (If confirmed)
    if (bookingConfirmed.status === 'confirmed') {
        let campaignId = null;
        if (coupons && coupons.length > 0) {
            campaignId = coupons[0].campaign_id;
        }

        if (campaignId) {
            console.log(`Decrementing redemption for campaign: ${campaignId}`);
            const { error: decError } = await supabase.rpc('decrement_campaign_redemption', {
                target_campaign_id: campaignId
            });
            if (decError) {
                console.error(`Failed to decrement redemption count:`, decError.message);
            } else {
                console.log(`Decremented redemption count for campaign: ${campaignId}`);
            }
        } else {
            console.log('No campaign found to decrement.');
        }
    }
}

cancel();
