
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runRace() {
    console.log('--- STARTING RACE CONDITION TEST ---');
    console.log('Goal: 2 Users try to grab the LAST slot simultaneously.');

    // Fetch the pending bookings for RACE_A and RACE_B
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .in('user_id', ['RACE_A', 'RACE_B']);

    if (!bookings || bookings.length !== 2) {
        console.error('Error: Could not find bookings for both racers.');
        return;
    }

    const bookingA = bookings.find(b => b.user_id === 'RACE_A');
    const bookingB = bookings.find(b => b.user_id === 'RACE_B');

    console.log(`RACE_A Booking: ${bookingA.booking_id}`);
    console.log(`RACE_B Booking: ${bookingB.booking_id}`);

    // Simulation Function
    const attemptPayment = async (booking, racerName) => {
        console.log(`[${racerName}] 🏁 Attempting Verification...`);

        // 1. Get Campaign ID from coupon
        const { data: coupon } = await supabase
            .from('user_coupons')
            .select('campaign_id')
            .eq('booking_id', booking.booking_id)
            .single();

        if (!coupon) {
            console.log(`[${racerName}] ❌ No coupon linked!`);
            return;
        }

        // 2. ATOMIC INCREMENT (RPC)
        const { data: success, error: rpcError } = await supabase.rpc('increment_campaign_redemption', {
            target_campaign_id: coupon.campaign_id
        });

        if (rpcError) {
            console.log(`[${racerName}] ❌ SYSTEM ERROR: ${rpcError.message}`);
            return `[${racerName}] ERROR`;
        }

        if (success === false) {
            console.log(`[${racerName}] ⚠️ DENIED: Limit reached (Race Lost)`);
            return `[${racerName}] LOST`;
        }

        console.log(`[${racerName}] ✅ SUCCESS verification! Slot acquired.`);

        // 3. Mark Paid
        await supabase.from('bookings').update({
            status: 'confirmed',
            payment_status: 'paid'
        }).eq('booking_id', booking.booking_id);

        return `[${racerName}] WON`;
    };

    // RACE START!
    const racePromises = [
        attemptPayment(bookingA, 'RACE_A'),
        attemptPayment(bookingB, 'RACE_B')
    ];

    const results = await Promise.all(racePromises);
    console.log('\n--- RACE RESULTS ---');
    console.log(results);
}

runRace();
