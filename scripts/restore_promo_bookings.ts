
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyprnvazjyilthdzhqxh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5cHJudmF6anlpbHRoZHpocXhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODg0MCwiZXhwIjoyMDg0MDQ0ODQwfQ.38YYSQQeZuT8BOyb1-nKUp2wzF8RYtFBeo4j2mRcAG0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function restorePromoBookings() {
    console.log("Restoring promo booking details...");

    // Get all used promo codes with booking_ids
    const { data: promos, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('status', 'used')
        .not('booking_id', 'is', null);

    if (error) {
        console.error("Error fetching promos:", error);
        return;
    }

    console.log(`Found ${promos.length} used promo codes. Processing...`);

    let updatedCount = 0;

    for (const p of promos) {
        // Fetch the booking
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('booking_id', p.booking_id)
            .single();

        if (bookingError || !booking) {
            console.log(`❌ Booking not found for promo ${p.code} (ID: ${p.booking_id})`);
            continue;
        }

        // Check if needs update
        if (!booking.is_promo || !booking.admin_note) {
            const note = booking.admin_note || `Promo Code: ${p.code} (${p.discount_amount} off)`;

            const { error: updateError } = await supabase
                .from('bookings')
                .update({
                    is_promo: true,
                    admin_note: note,
                    source: 'line' // Explicitly set source to line as requested
                })
                .eq('booking_id', p.booking_id);

            if (updateError) {
                console.error(`❌ Failed to update booking ${p.booking_id}:`, updateError);
            } else {
                console.log(`✅ Updated Booking ${p.booking_id} (Team: ${booking.display_name}) - Set is_promo=true`);
                updatedCount++;
            }
        }
    }

    console.log(`\n🎉 Restore Complete! Updated ${updatedCount} bookings.`);
}

restorePromoBookings();
