
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulate() {
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
        process.exit(1);
    }

    if (!booking) {
        console.error('❌ No pending booking found. Please create a booking first!');
        process.exit(1);
    }

    console.log(`✅ Found Booking: ${booking.booking_id} (User: ${booking.display_name}, Amount: ${booking.price_total_thb} THB)`);

    if (booking.is_promo) {
        console.log('✨ Processing promo redemption...');
        const { data: coupons } = await supabase
            .from('user_coupons')
            .select('*, campaigns(*)')
            .eq('booking_id', booking.booking_id);

        if (coupons && coupons.length > 0) {
            const campaign = coupons[0].campaigns;
            console.log(`📦 Campaign: ${campaign.name}`);
            const { error: incError } = await supabase.rpc('increment_campaign_redemption', {
                target_campaign_id: campaign.id
            });
            if (incError) console.error('❌ RPC Error:', incError.message);
            else console.log('✅ Redemption incremented!');
        }
    }

    const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed', payment_status: 'paid', updated_at: new Date().toISOString() })
        .eq('booking_id', booking.booking_id);

    if (updateError) console.error('❌ Update Error:', updateError);
    else console.log('🎉 SUCCESS! Booking confirmed.');
}

simulate();
