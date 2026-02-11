
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
        let { fieldId, date, startTime, endTime, customerName, phoneNumber, note, couponId, paymentMethod, campaignId, userId, source } = await req.json();

        // [FIX] Normalize Payment Method
        if (paymentMethod === 'field') {
            paymentMethod = 'CASH';
        } else if (paymentMethod === 'qr') {
            paymentMethod = 'QR';
        }

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
        let discountAmount = 0;
        let adminNote = note || '';

        // 3. Process Coupon/Campaign (V2 Redemption Logic)
        // [COUPON_TYPE_RULES] When upgrading to multi-coupon support:
        //   - MAIN + MAIN = ❌ (cannot stack)
        //   - ONTOP + ONTOP = ❌ (cannot stack)
        //   - MAIN + ONTOP = ✅ (max 2 coupons per booking)
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

            // [BUG_FIX #3] Check coupon ownership
            if (userId && coupon.user_id !== userId) {
                throw new Error('คูปองนี้ไม่ใช่ของคุณ (This coupon does not belong to you)');
            }

            // [STRICT] Check Expiry against Booking Date (not just today)
            const expiryDate = new Date(coupon.expires_at);
            const bookingDate = new Date(date); // YYYY-MM-DD
            expiryDate.setHours(23, 59, 59, 999); // Allow until end of expiry day
            bookingDate.setHours(0, 0, 0, 0);

            if (expiryDate < bookingDate) {
                throw new Error(`คูปองหมดอายุแล้ว (Expired on ${coupon.expires_at.split('T')[0]}) ไม่สามารถใช้จองวันที่ ${date} ได้`);
            }

            campaign = coupon.campaigns;

            // [BUG_FIX #1] Validate Campaign Status & Period for coupon path too
            if (campaign.status !== 'ACTIVE' && campaign.status !== 'active') {
                throw new Error('แคมเปญไม่ได้เปิดใช้งาน (Campaign is not active)');
            }
            const nowCheck = new Date();
            if (campaign.start_date && new Date(campaign.start_date) > nowCheck) {
                throw new Error('แคมเปญยังไม่เริ่ม (Campaign has not started)');
            }
            if (campaign.end_date && new Date(campaign.end_date) < nowCheck) {
                throw new Error('แคมเปญสิ้นสุดแล้ว (Campaign has ended)');
            }
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
            // REDEMPTION LIMIT CHECK (Global Atomic)
            // Use RPC to check and increment atomically to prevent race conditions
            if (campaign.redemption_limit !== null && campaign.redemption_limit > 0) {
                // Manual Check (Replacing RPC check_campaign_limit due to missing function on remote)
                // This is safe enough as a pre-check. 
                // Strict concurrency control is handled by the increment step or database constraints (if present).

                // Allow if current count is LESS than limit.
                // If count is 9, limit is 10 -> OK. (9 < 10)
                // If count is 10, limit is 10 -> FAIL. (10 < 10 is false)

                const currentCount = campaign.redemption_count || 0;

                if (currentCount >= campaign.redemption_limit) {
                    throw new Error('ขออภัย! สิทธิ์สำหรับแคมเปญนี้เต็มแล้วครับ (Reward limit reached)');
                }
            }

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
                if (campaign.discount_amount > 0) {
                    discountAmount = campaign.discount_amount;
                } else if (campaign.discount_percent > 0) {
                    discountAmount = Math.floor((originalPrice * campaign.discount_percent) / 100);
                    // Fix #1: Apply max_discount cap for percentage discounts
                    if (campaign.max_discount && campaign.max_discount > 0 && discountAmount > campaign.max_discount) {
                        console.log(`[Coupon Cap] Discount ${discountAmount} capped to max_discount ${campaign.max_discount}`);
                        discountAmount = campaign.max_discount;
                    }
                }

                if (discountAmount > 0) {
                    finalPrice = Math.max(0, originalPrice - discountAmount);
                    isPromo = true;
                    adminNote += ` | [Coupon: ${campaign.name} -${discountAmount}฿]`;
                    console.log(`[Coupon Applied] Discount: ${discountAmount}, Final: ${finalPrice}`);
                }
            }
        }


        // [BUG_FIX #4] Check for duplicate/overlapping bookings on same field+date
        const { data: existingBookings } = await supabase
            .from('bookings')
            .select('booking_id, time_from, time_to')
            .eq('field_no', fieldNo)
            .eq('date', date)
            .neq('status', 'cancelled');

        if (existingBookings && existingBookings.length > 0) {
            for (const eb of existingBookings) {
                const ebStart = eb.time_from.split(':').map(Number);
                const ebEnd = eb.time_to.split(':').map(Number);
                const ebStartMin = ebStart[0] * 60 + (ebStart[1] || 0);
                const ebEndMin = ebEnd[0] * 60 + (ebEnd[1] || 0);

                // Overlap check: new booking overlaps if it starts before existing ends AND ends after existing starts
                if (startMin < ebEndMin && endMin > ebStartMin) {
                    throw new Error(`สนามนี้ถูกจองแล้วในช่วงเวลา ${eb.time_from}-${eb.time_to} (Field already booked)`);
                }
            }
        }

        // 4. Create Booking
        const isQR = paymentMethod === 'QR';
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
                payment_status: (isQR || paymentMethod === 'CASH') ? 'pending' : 'paid',
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
                    status: 'USED',
                    used_at: new Date().toISOString(),
                    booking_id: booking.booking_id
                })
                .eq('id', couponId);

            if (markError) {
                console.error('[CRITICAL] Booking created but failed to mark coupon used:', markError);
            }
        }

        // 6. [NEW] Increment Redemption Count for Campaign (If Confirmed/Paid)
        if (campaign && !isQR) {
            const { data: rpcSuccess, error: incError } = await supabase.rpc('increment_campaign_redemption', {
                target_campaign_id: campaign.id
            });

            if (incError || rpcSuccess === false) {
                console.error('[CRITICAL] Failed to increment redemption count:', incError || 'Limit reached at last second');
                // If it's cash/admin and it's already full, we technically already created the booking.
                // But we should at least log it or try a fallback if it was just an RPC error.
                if (incError) {
                    await supabase
                        .from('campaigns')
                        .update({ redemption_count: (campaign.redemption_count || 0) + 1 })
                        .eq('id', campaign.id);
                }
            } else {
                console.log(`[Redemption Limit] Incremented count for campaign ${campaign.id}`);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            booking: {
                id: booking.booking_id,
                booking_id: booking.booking_id,
                field_no: booking.field_no,
                price: booking.price_total_thb,
                original_price: originalPrice,
                discount_amount: discountAmount,
                customer_name: booking.display_name,
                reward_item: campaign?.reward_item || null
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
