
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pushMessage } from "../_shared/lineClient.ts";
import { buildCancelTimeoutFlex } from "../webhook/flexMessages.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        const now = new Date().toISOString();

        // 1. Find pending_payment bookings older than 10 mins (timeout_at < NOW)
        const { data: expiredBookings, error: findError } = await supabase
            .from('bookings')
            .select('booking_id, user_id, display_name, date, time_from, time_to, price_total_thb, deposit_amount, field_no')
            .eq('status', 'pending_payment')
            .lt('timeout_at', now);

        if (findError) throw findError;

        if (!expiredBookings || expiredBookings.length === 0) {
            return new Response(JSON.stringify({ message: "No expired bookings found" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Cron Cancel] Found ${expiredBookings.length} expired bookings.`);

        let successCount = 0;
        let failCount = 0;

        for (const booking of expiredBookings) {
            try {
                // 2. Cancel the booking
                const { error: cancelError } = await supabase
                    .from('bookings')
                    .update({
                        status: 'cancelled',
                        cancel_reason: 'ชำระเงินไม่ทันตามเวลาที่กำหนด (10 นาที)',
                        updated_at: now
                    })
                    .eq('booking_id', booking.booking_id);

                if (cancelError) throw cancelError;

                // 2.1 Release Coupon (If any)
                // We find the coupon using the booking_id
                const { data: coupons, error: couponError } = await supabase
                    .from('user_coupons')
                    .update({
                        status: 'ACTIVE',
                        used_at: null,
                        booking_id: null
                    })
                    .eq('booking_id', booking.booking_id)
                    .select();

                if (couponError) {
                    console.error(`[Cron Cancel] Failed to release coupon for ${booking.booking_id}:`, couponError.message);
                } else if (coupons && coupons.length > 0) {
                    console.log(`[Cron Cancel] Released coupon for booking: ${booking.booking_id}`);
                }

                // 3. Notify User
                if (booking.user_id) {
                    try {
                        let fieldLabel = `Field ${booking.field_no}`;
                        const { data: fieldData } = await supabase
                            .from('fields')
                            .select('label')
                            .eq('id', booking.field_no)
                            .maybeSingle();

                        if (fieldData?.label) fieldLabel = fieldData.label;

                        const cancelFlex = buildCancelTimeoutFlex({
                            teamName: booking.display_name,
                            fieldName: fieldLabel,
                            date: booking.date,
                            timeFrom: booking.time_from,
                            timeTo: booking.time_to,
                            price: booking.price_total_thb || 0,
                            depositAmount: booking.deposit_amount || 0,
                            bookingId: booking.booking_id
                        });

                        await pushMessage(booking.user_id, cancelFlex);
                    } catch (notifyErr: any) {
                        console.error(`[Cron Cancel] Failed to send flex message for ${booking.booking_id}:`, notifyErr.message);
                        // Fallback to text message
                        await pushMessage(booking.user_id, {
                            type: 'text',
                            text: "⚠️ ไม่ได้ชำระภายในเวลาที่กำหนด การจองถูกยกเลิกแล้ว ขอบคุณค่ะ"
                        });
                    }
                }

                console.log(`[Cron Cancel] Cancelled booking: ${booking.booking_id}`);
                successCount++;
            } catch (err: any) {
                console.error(`[Cron Cancel] Failed to cancel ${booking.booking_id}:`, err.message);
                failCount++;
            }
        }

        return new Response(JSON.stringify({
            success: true,
            total: expiredBookings.length,
            cancelled: successCount,
            failed: failCount
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Cron Cancel Error]:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
