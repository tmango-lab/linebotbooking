
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";
import { pushMessage } from "../_shared/lineClient.ts";
import { buildBookingSuccessFlex } from "../webhook/flexMessages.ts";

console.log("Create Booking Function Started (Local DB Only)");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Field ID Mapping (Matchday court_id to local field_no)
const FIELD_MAP: Record<number, number> = {
    2424: 1, 2425: 2, 2428: 3, 2426: 4, 2427: 5, 2429: 6
};

// Pricing Config (Same as update-booking)
const PRICING = {
    1: { pre: 500, post: 700 }, // Field 1
    2: { pre: 500, post: 700 }, // Field 2
    3: { pre: 1000, post: 1200 }, // Field 3 (7-a-side)
    4: { pre: 800, post: 1000 }, // Field 4 (7-a-side)
    5: { pre: 800, post: 1000 }, // Field 5
    6: { pre: 1000, post: 1200 }, // Field 6
};

function calculatePrice(fieldNo: number, startTime: string, durationHours: number) {
    const prices = PRICING[fieldNo as keyof typeof PRICING];
    if (!prices) return 0;

    const [h, m] = startTime.split(':').map(Number);
    const startH = h + (m / 60);
    const endH = startH + durationHours;
    const cutOff = 18.0;

    let preHours = 0;
    let postHours = 0;

    if (endH <= cutOff) preHours = durationHours;
    else if (startH >= cutOff) postHours = durationHours;
    else {
        preHours = cutOff - startH;
        postHours = endH - cutOff;
    }

    let prePrice = preHours * prices.pre;
    let postPrice = postHours * prices.post;

    if (prePrice > 0 && prePrice % 100 !== 0) {
        prePrice = Math.ceil(prePrice / 100) * 100;
    }
    if (postPrice > 0 && postPrice % 100 !== 0) {
        postPrice = Math.ceil(postPrice / 100) * 100;
    }

    return Math.round(prePrice + postPrice);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { fieldId, date, startTime, endTime, customerName, phoneNumber, note, couponId, paymentMethod, campaignId, userId, source } = await req.json();

        // 1. Basic Validation
        if (!fieldId || !date || !startTime || !endTime || !customerName || !phoneNumber) {
            throw new Error('Missing required fields');
        }

        console.log(`[Create Booking] User: ${userId || 'CHECK-IN'} | F${fieldId} on ${date} ${startTime}-${endTime} | Coupon: ${couponId || 'None'} | Pay: ${paymentMethod || 'N/A'}`);

        // 2. Prepare Data
        const fieldNo = FIELD_MAP[fieldId] || fieldId;
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        const durationH = (endMin - startMin) / 60;

        const originalPrice = calculatePrice(fieldNo, startTime, durationH);
        let finalPrice = originalPrice;
        let isPromo = false;
        let adminNote = note || '';

        // 3. Process Coupon/Campaign (V2 Redemption Logic)
        let campaign: any = null;

        if (couponId) {
            // A. Fetch Coupon with Campaign Rules
            const { data: coupon, error: couponError } = await supabase
                .from('user_coupons')
                .select('*, campaigns(*)')
                .eq('id', couponId)
                .single();

            if (couponError || !coupon) throw new Error('Invalid Coupon ID');
            if (coupon.status !== 'ACTIVE') throw new Error('Coupon is not active (Used or Expired)');
            if (new Date(coupon.expires_at) < new Date()) throw new Error('Coupon has expired');

            campaign = coupon.campaigns;
        } else if (campaignId) {
            // A2. Fetch Campaign Directly (Admin Override)
            const { data: camp, error: campError } = await supabase
                .from('campaigns')
                .select('*')
                .eq('id', campaignId)
                .single();

            if (campError || !camp) throw new Error('Invalid Campaign ID');
            if (camp.status !== 'active') throw new Error('Campaign is not active');

            // Check Campaign Period
            const now = new Date();
            if (new Date(camp.start_date) > now) throw new Error('Campaign has not started yet');
            if (new Date(camp.end_date) < now) throw new Error('Campaign has ended');

            campaign = camp;
        }

        if (campaign) {
            // B. Validate Micro-Conditions

            // B1. Field Check
            if (campaign.eligible_fields && campaign.eligible_fields.length > 0) {
                if (!campaign.eligible_fields.includes(fieldNo)) {
                    throw new Error(`Coupon valid only for Field ${campaign.eligible_fields.join(', ')}`);
                }
            }

            // B2. Time Check
            if (campaign.valid_time_start || campaign.valid_time_end) {
                const bookingStart = parseFloat(startTime.replace(':', '.'));
                if (campaign.valid_time_start) {
                    const validStart = parseFloat(campaign.valid_time_start.slice(0, 5).replace(':', '.'));
                    if (bookingStart < validStart) throw new Error(`Coupon valid from ${campaign.valid_time_start}`);
                }
                if (campaign.valid_time_end) {
                    const validEnd = parseFloat(campaign.valid_time_end.slice(0, 5).replace(':', '.'));
                    if (bookingStart >= validEnd) throw new Error(`Coupon valid until ${campaign.valid_time_end}`);
                }
            }

            // B3. Min Spend Check
            if (campaign.min_spend && campaign.min_spend > 0) {
                if (originalPrice < campaign.min_spend) {
                    throw new Error(`Minimum spend of ${campaign.min_spend} THB required (Current: ${originalPrice})`);
                }
            }

            // B4. Eligible Days Check
            if (campaign.eligible_days && campaign.eligible_days.length > 0) {
                // Get 'Mon', 'Tue' from date
                const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue...
                if (!campaign.eligible_days.includes(dayName)) {
                    throw new Error(`Coupon valid only on ${campaign.eligible_days.join(', ')} (Selected: ${dayName})`);
                }
            }

            // B5. Payment Method Check
            if (campaign.payment_methods && campaign.payment_methods.length > 0) {
                // If payment method is required by coupon, it MUST be provided in payload
                if (!paymentMethod) {
                    throw new Error(`Coupon requires specific payment method (${campaign.payment_methods.join(', ')}). Please select payment method.`);
                }
                if (!campaign.payment_methods.includes(paymentMethod)) {
                    throw new Error(`Coupon valid only for payment by ${campaign.payment_methods.join(', ')}`);
                }
            }

            // C. Apply Benefit
            if (campaign.reward_item) {
                // Item Reward
                isPromo = true;
                adminNote += ` | [REWARD: ${campaign.reward_item}]`;
                console.log(`[Coupon Applied] Reward: ${campaign.reward_item}`);
                // No price reduction
            } else {
                // Money Discount
                let discountAmount = 0;
                if (campaign.discount_amount > 0) {
                    discountAmount = campaign.discount_amount;
                } else if (campaign.discount_percent > 0) {
                    discountAmount = Math.floor((originalPrice * campaign.discount_percent) / 100);
                }

                if (discountAmount > 0) {
                    finalPrice = Math.max(0, originalPrice - discountAmount);
                    isPromo = true;
                    adminNote += ` | [Coupon: ${campaign.name} -${discountAmount}฿]`;
                    console.log(`[Coupon Applied] Discount: ${discountAmount}, Final: ${finalPrice}`);
                }
            }
        }


        // 4. Create Booking
        const isQR = paymentMethod === 'qr';
        const timeoutMinutes = 10;
        const timeoutAt = isQR ? new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString() : null;

        if (isQR) {
            adminNote = (adminNote ? adminNote + ' | ' : '') + `[Deposit 200 THB Required]`;
        }

        const { data: booking, error: insertError } = await supabase
            .from('bookings')
            .insert({
                user_id: userId,
                booking_id: Date.now().toString(),
                field_no: fieldNo,
                status: isQR ? 'pending_payment' : 'confirmed',
                payment_status: isQR ? 'pending' : 'paid',
                payment_method: paymentMethod || 'cash',
                timeout_at: timeoutAt,
                date: date,
                time_from: startTime,
                time_to: endTime,
                duration_h: durationH,
                price_total_thb: finalPrice,
                display_name: customerName,
                phone_number: phoneNumber,
                admin_note: adminNote || null,
                source: source || 'line',
                is_promo: isPromo,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // 4.1 Append Payment Method to Note if provided (and update booking)
        // [MODIFIED] Removed redundant update since we now store payment_method directly

        // 4.2 Send LINE Notification
        try {
            const fieldLabel = (await supabase.from('fields').select('label').eq('id', fieldNo).single()).data?.label || `Field ${fieldNo}`;
            const successFlex = buildBookingSuccessFlex({
                teamName: customerName,
                fieldName: fieldLabel,
                date: date,
                timeFrom: startTime,
                timeTo: endTime,
                price: finalPrice,
                paymentMethod: paymentMethod || 'N/A'
            });
            if (userId) {
                await pushMessage(userId, successFlex);
                console.log(`[Notification Sent] User: ${userId}`);
            } else {
                console.log(`[Notification Skipped] No User ID provided (Admin Booking)`);
            }
        } catch (notifierErr) {
            console.error('[Notification Error]:', notifierErr);
            // Non-blocking error
        }

        // 5. Mark Coupon as Used (Atomic-ish)
        if (couponId) {
            const { error: markError } = await supabase
                .from('user_coupons')
                .update({
                    status: 'used',
                    booking_id: booking.booking_id,
                    used_at: new Date().toISOString()
                })
                .eq('id', couponId);

            if (markError) {
                console.error('[CRITICAL] Booking created but failed to mark coupon used:', markError);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            booking: {
                id: booking.booking_id,
                field_no: booking.field_no,
                price: booking.price_total_thb,
                customer_name: booking.display_name
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Create Booking Error]:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
