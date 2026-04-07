
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";
import { pushMessage } from "../_shared/lineClient.ts";

console.log("Cancel Booking Function Started (with Smart Refund)");

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
        const { matchId, reason, isRefunded, shouldReturnCoupon, refundStripe } = await req.json();

        if (!matchId) {
            return new Response(JSON.stringify({ error: 'Missing matchId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Cancel Booking] Request to cancel booking ${matchId}. Reason: ${reason || 'N/A'}, Refunded: ${isRefunded}, RefundStripe: ${refundStripe}, ReturnCoupon: ${shouldReturnCoupon}`);

        // Fetch booking first to check for promo/campaign
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('booking_id', String(matchId))
            .single();

        if (fetchError || !booking) throw new Error('Booking not found');

        // ─── Stripe Refund Logic ────────────────────────────────
        let stripeRefundResult: any = null;
        if (refundStripe && booking.stripe_payment_intent_id) {
            const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
            if (!STRIPE_SECRET_KEY) {
                throw new Error('STRIPE_SECRET_KEY not configured');
            }

            const depositAmount = booking.deposit_amount || 0;
            if (depositAmount > 0) {
                // คืนเงินเต็มจำนวน 100% (สนามยอมแบกค่าธรรมเนียม Stripe)
                const refundAmountSatang = Math.round(depositAmount * 100);

                console.log(`[Cancel Booking] Initiating Stripe refund: ${depositAmount} THB (${refundAmountSatang} satang) for PI: ${booking.stripe_payment_intent_id}`);

                try {
                    const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            'payment_intent': booking.stripe_payment_intent_id,
                            'amount': refundAmountSatang.toString(),
                        }).toString(),
                    });

                    const refundData = await refundRes.json();

                    if (refundData.error) {
                        console.error(`[Cancel Booking] Stripe refund error:`, refundData.error);
                        throw new Error(`Stripe refund failed: ${refundData.error.message}`);
                    }

                    console.log(`[Cancel Booking] Stripe refund SUCCESS: ${refundData.id} | Amount: ${depositAmount} THB`);
                    stripeRefundResult = {
                        refundId: refundData.id,
                        amount: depositAmount,
                        status: refundData.status,
                    };
                } catch (stripeErr: any) {
                    console.error(`[Cancel Booking] Stripe refund error:`, stripeErr);
                    throw new Error(`ไม่สามารถคืนเงินผ่าน Stripe ได้: ${stripeErr.message}`);
                }
            }
        }
        // ─── End Stripe Refund Logic ────────────────────────────

        // Build admin note
        let adminNote = reason || 'Cancelled via System';
        if (stripeRefundResult) {
            adminNote += ` [STRIPE REFUND: ฿${stripeRefundResult.amount}]`;
        } else if (isRefunded) {
            adminNote += ' [REFUNDED]';
        }

        // Update booking status to cancelled in Local DB
        const { data, error } = await supabase
            .from('bookings')
            .update({
                status: 'cancelled',
                admin_note: adminNote,
                is_refunded: !!isRefunded || !!stripeRefundResult,
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
            console.log(`[Cancel Booking] Booking confirmed. NOT releasing coupon (User forfeits right).`);

            const { data: usedCoupons } = await supabase
                .from('user_coupons')
                .select('*, campaigns(*)')
                .eq('booking_id', String(matchId));
            coupons = usedCoupons;
        }

        // 2. Decrement Redemption Count (If confirmed)
        if (booking.status === 'confirmed') {
            let campaignId = null;
            if (coupons && coupons.length > 0) {
                campaignId = coupons[0].campaign_id;
            } else if (booking.admin_note?.includes('[Coupon:')) {
                // Try to extract from note
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

        // ─── 3. LINE Notification to Customer ──────────────────────
        if (booking.user_id) {
            try {
                // Fetch field label
                const { data: fieldData } = await supabase
                    .from('fields')
                    .select('label')
                    .eq('id', booking.field_no)
                    .single();
                const fieldLabel = fieldData?.label || `สนาม ${booking.field_no}`;
                const timeFrom = (booking.time_from || '').substring(0, 5);
                const timeTo = (booking.time_to || '').substring(0, 5);

                let lineMsg = '';
                if (stripeRefundResult) {
                    // Refund case
                    lineMsg = `❌ การจองของคุณถูกยกเลิก\n\n` +
                        `📍 ${fieldLabel}\n` +
                        `📅 ${booking.date}\n` +
                        `⏰ ${timeFrom} - ${timeTo}\n\n` +
                        `💰 คืนเงินมัดจำ ฿${stripeRefundResult.amount} เต็มจำนวน\n` +
                        `📝 เหตุผล: ${reason || 'เหตุสุดวิสัย'}\n\n` +
                        `เงินจะคืนเข้าบัญชีภายใน 5-10 วันทำการ ขออภัยในความไม่สะดวกค่ะ 🙏`;
                } else {
                    // Normal cancel (no refund)
                    lineMsg = `❌ การจองของคุณถูกยกเลิก\n\n` +
                        `📍 ${fieldLabel}\n` +
                        `📅 ${booking.date}\n` +
                        `⏰ ${timeFrom} - ${timeTo}\n\n` +
                        `📝 ${reason || 'ยกเลิกโดยแอดมิน'}\n\n` +
                        `หากมีข้อสงสัย ติดต่อสนามได้เลยค่ะ`;
                }

                await pushMessage(booking.user_id, { type: 'text', text: lineMsg });
                console.log(`[Cancel Booking] LINE notification sent to ${booking.user_id}`);
            } catch (lineErr) {
                console.error(`[Cancel Booking] LINE notify error:`, lineErr);
                // ไม่ throw — ให้การยกเลิกสำเร็จแม้ส่ง LINE ไม่ได้
            }
        }
        // ─── End LINE Notification ──────────────────────────────

        console.log(`[Cancel Booking] Success: ${matchId}`);

        return new Response(JSON.stringify({
            success: true,
            message: `Booking ${matchId} cancelled successfully`,
            booking: data,
            stripeRefund: stripeRefundResult,
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
