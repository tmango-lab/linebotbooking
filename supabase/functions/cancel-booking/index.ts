
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";

console.log("Cancel Booking Function Started (Local DB Only)");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { matchId, reason, isRefunded, shouldReturnCoupon } = await req.json();

        if (!matchId) {
            return new Response(JSON.stringify({ error: 'Missing matchId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Cancel Booking] Request to cancel booking ${matchId}. Reason: ${reason || 'N/A'}, Refunded: ${isRefunded}, ReturnCoupon: ${shouldReturnCoupon}`);

        // Fetch booking first to check for promo/campaign
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('booking_id', String(matchId))
            .single();

        if (fetchError || !booking) throw new Error('Booking not found');

        // Update booking status to cancelled in Local DB
        const { data, error } = await supabase
            .from('bookings')
            .update({
                status: 'cancelled',
                admin_note: (reason || 'Cancelled via System') + (isRefunded ? ' [REFUNDED]' : ''),
                is_refunded: !!isRefunded,
                updated_at: new Date().toISOString()
            })
            .eq('booking_id', String(matchId))
            .select()
            .single();

        if (error) {
            console.error('[Cancel Booking Error]:', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 1. Release Coupon Logic
        // Rule:
        // - If status was 'pending_payment' (Timeout/System): Release Coupon (Back to ACTIVE).
        // - If shouldReturnCoupon is TRUE: Release Coupon (Back to ACTIVE).
        // - If status was 'confirmed' AND !shouldReturnCoupon: DO NOT Release Coupon (Burned), but decrement Campaign Count.

        let coupons = null;
        if (booking.status !== 'confirmed' || shouldReturnCoupon) {
            // Case: Pending/Timeout -> Release back to user
            const { data: releasedCoupons, error: couponError } = await supabase
                .from('user_coupons')
                .update({
                    status: 'ACTIVE',
                    used_at: null,
                    booking_id: null
                })
                .eq('booking_id', String(matchId))
                .select('*, campaigns(*)');

            if (couponError) {
                console.error(`[Cancel Booking] Failed to release coupon:`, couponError.message);
            } else {
                coupons = releasedCoupons;
                console.log(`[Cancel Booking] Released coupon for non-confirmed booking: ${matchId}`);
            }
        } else {
            // Case: Confirmed/Paid -> User Penalty (Burned)
            // We do NOT update user_coupons status. It remains 'USED' (or whatever it was).
            console.log(`[Cancel Booking] Booking confirmed. NOT releasing coupon (User forfeits right).`);

            // However, we MUST fetch campaign info to decrement the GLOBAL redemption count
            const { data: usedCoupons } = await supabase
                .from('user_coupons')
                .select('*, campaigns(*)')
                .eq('booking_id', String(matchId));
            coupons = usedCoupons;
        }

        // 2. Decrement Redemption Count (If confirmed)
        // If the booking status was 'confirmed', it means the count was likely incremented.
        // We decrement it so SOMEONE ELSE can use the quota.
        if (booking.status === 'confirmed') {
            let campaignId = null;
            if (coupons && coupons.length > 0) {
                campaignId = coupons[0].campaign_id;
            } else if (booking.admin_note?.includes('[Coupon:')) {
                // Try to extract from note or matching user_coupons (which we already did)
                // If it's a direct campaign booking without user_coupon id (admin override)
                // we might need to find it by name or just hope it was in user_coupons.
            }

            if (campaignId) {
                const { error: decError } = await supabase.rpc('decrement_campaign_redemption', {
                    target_campaign_id: campaignId
                });
                if (decError) {
                    console.error(`[Cancel Booking] Failed to decrement redemption count:`, decError.message);
                } else {
                    console.log(`[Cancel Booking] Decremented redemption count for campaign: ${campaignId}`);
                }
            }
        }

        console.log(`[Cancel Booking] Success: ${matchId}`);

        return new Response(JSON.stringify({
            success: true,
            message: `Booking ${matchId} cancelled successfully`,
            booking: data
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Cancel Booking Error]:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
