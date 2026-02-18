
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
        let { fieldId, date, startTime, endTime, customerName, phoneNumber, note, couponId, couponIds, paymentMethod, campaignId, userId, source, referralCode } = await req.json();

        // Support both single couponId (legacy) and couponIds array
        let usageCouponIds: string[] = [];
        if (couponIds && Array.isArray(couponIds)) {
            usageCouponIds = couponIds;
        } else if (couponId) {
            usageCouponIds = [couponId];
        }

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

        // [REFERRAL] Validate referral code and apply discount
        let referralData: { referrerId: string; programId: string; discountPercent: number; rewardAmount: number } | null = null;
        if (referralCode) {
            console.log(`[Referral] Validating code: ${referralCode}`);
            // 1. Find affiliate by code
            const { data: affiliate } = await supabase
                .from('affiliates')
                .select('user_id, status')
                .eq('referral_code', referralCode)
                .eq('status', 'APPROVED')
                .maybeSingle();

            if (affiliate && affiliate.user_id !== userId) {
                // 2. Check active program
                const { data: program } = await supabase
                    .from('referral_programs')
                    .select('id, discount_percent, reward_amount, end_date')
                    .eq('is_active', true)
                    .maybeSingle();

                if (program && (!program.end_date || new Date(program.end_date) >= new Date())) {
                    // 3. Check if this user has already been referred (first time only)
                    const { data: existingRef } = await supabase
                        .from('referrals')
                        .select('id')
                        .eq('referee_id', userId)
                        .maybeSingle();

                    if (!existingRef) {
                        referralData = {
                            referrerId: affiliate.user_id,
                            programId: program.id,
                            discountPercent: program.discount_percent || 50,
                            rewardAmount: program.reward_amount || 100
                        };
                        // Apply referral discount
                        const refDiscount = Math.floor((originalPrice * referralData.discountPercent) / 100);
                        discountAmount += refDiscount;
                        finalPrice = Math.max(0, originalPrice - discountAmount);
                        isPromo = true;
                        console.log(`[Referral] Applied ${referralData.discountPercent}% discount: -${refDiscount} THB. Final: ${finalPrice}`);
                    } else {
                        console.log(`[Referral] User ${userId} already referred. Skipping discount.`);
                    }
                } else {
                    console.log(`[Referral] No active program or expired.`);
                }
            } else {
                console.log(`[Referral] Invalid code, not approved, or self-referral.`);
            }
        }

        // 3. Process Coupon/Campaign (V2 Redemption Logic)
        // [COUPON_TYPE_RULES] When upgrading to multi-coupon support:
        //   - MAIN + MAIN = ❌ (cannot stack)
        //   - ONTOP + ONTOP = ❌ (cannot stack)
        //   - MAIN + ONTOP = ✅ (max 2 coupons per booking)
        let campaign: any = null;

        // 3. Process Coupons (Multi-Support)
        let campaignsToIncrement: any[] = [];
        let usedCouponIds: string[] = [];

        if (usageCouponIds.length > 0) {
            // Fetch All Coupons using `in` filter
            const { data: coupons, error: couponError } = await supabase
                .from('user_coupons')
                .select('*, campaigns(*)')
                .in('id', usageCouponIds);

            if (couponError || !coupons) throw new Error('Invalid Coupons');

            // Categorize to ensure rules (Max 1 Main, Max 1 On-top) - Optional Strictness
            // For now, simpler validation: Check ownership & Validity for each.

            for (const coupon of coupons) {
                if (coupon.status !== 'ACTIVE') throw new Error(`Coupon ${coupon.id} is not active`);
                if (userId && coupon.user_id !== userId) throw new Error('Coupon ownership mismatch');

                // Expiry Check
                const expiryDate = new Date(coupon.expires_at);
                const bookingDate = new Date(date);
                expiryDate.setHours(23, 59, 59, 999);
                bookingDate.setHours(0, 0, 0, 0);
                if (expiryDate < bookingDate) throw new Error(`Coupon ${coupon.id} expired`);

                const campaign = coupon.campaigns;
                if (campaign.status !== 'ACTIVE' && campaign.status !== 'active') throw new Error('Campaign not active');

                // Campaign Period
                const nowCheck = new Date();
                if (campaign.start_date && new Date(campaign.start_date) > nowCheck) throw new Error('Campaign not started');
                if (campaign.end_date && new Date(campaign.end_date) < nowCheck) throw new Error('Campaign ended');

                // Limits
                if (campaign.redemption_limit !== null && campaign.redemption_limit > 0) {
                    const currentCount = campaign.redemption_count || 0;
                    if (currentCount >= campaign.redemption_limit) throw new Error(`Campaign ${campaign.name} limit reached`);
                }

                // Micro-Conditions Validation (Simplified reuse)
                // Field
                if (campaign.eligible_fields && campaign.eligible_fields.length > 0 && !campaign.eligible_fields.includes(fieldNo)) {
                    throw new Error(`Coupon ${campaign.name} not valid for this field`);
                }
                // Time
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
                // Min Spend
                if (campaign.min_spend && originalPrice < campaign.min_spend) throw new Error(`Min spend ${campaign.min_spend} required`);

                // Days
                if (campaign.eligible_days && campaign.eligible_days.length > 0) {
                    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                    if (!campaign.eligible_days.includes(dayName)) throw new Error(`Coupon valid only on ${campaign.eligible_days.join(', ')}`);
                }

                // Payment Method
                if (campaign.payment_methods && campaign.payment_methods.length > 0) {
                    if (!paymentMethod || !campaign.payment_methods.includes(paymentMethod)) throw new Error(`Invalid payment method for coupon ${campaign.name}`);
                }

                // C. Apply Benefit
                if (campaign.reward_item) {
                    // Item Reward
                    isPromo = true;
                    // adminNote += ` | [REWARD: ${campaign.reward_item}]`; // [MOD] Keep admin_note clean
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
                        // adminNote += ` | [Coupon: ${campaign.name} -${discountAmount}฿]`; // [MOD] Keep admin_note clean
                        console.log(`[Coupon Applied] Discount: ${discountAmount}, Final: ${finalPrice}`);
                    }
                }
                campaignsToIncrement.push(campaign);
                usedCouponIds.push(coupon.id);
            }

            // Cap total discount to not exceed original price
            if (discountAmount > originalPrice) discountAmount = originalPrice;
            finalPrice = Math.max(0, originalPrice - discountAmount);

        } else if (campaignId) {
            // ... (Keep existing Admin Campaign override logic if needed, or assume it's legacy)
            // For brevity, skipping re-implementation of campaignId override unless requested.
            // It was used for direct admin bookings without user_coupons.
            const { data: camp, error: campError } = await supabase
                .from('campaigns')
                .select('*')
                .eq('id', campaignId)
                .single();

            if (!campError && camp && camp.status === 'active') {
                // Simplified application for direct campaign
                let amount = 0;
                if (camp.discount_amount > 0) amount = camp.discount_amount;
                if (amount > 0) {
                    discountAmount = amount;
                    finalPrice = Math.max(0, originalPrice - discountAmount);
                    isPromo = true;
                    adminNote += ` | [Admin Promo: ${camp.name} -${amount}฿]`;
                }
                campaignsToIncrement.push(camp);
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

        // 5. Mark Coupons as Used (Atomic-ish)
        if (usedCouponIds.length > 0) {
            const { error: markError } = await supabase
                .from('user_coupons')
                .update({
                    status: 'USED',
                    used_at: new Date().toISOString(),
                    booking_id: booking.booking_id
                })
                .in('id', usedCouponIds);

            if (markError) console.error('[CRITICAL] Failed to mark coupons used', markError);
        }

        // 6. [NEW] Increment Redemption Count for Campaigns (If Confirmed/Paid)
        if (campaignsToIncrement.length > 0 && !isQR) {
            for (const camp of campaignsToIncrement) {
                const { data: rpcSuccess, error: incError } = await supabase.rpc('increment_campaign_redemption', {
                    target_campaign_id: camp.id
                });
                if (incError) console.error(`[CRITICAL] Failed to increment redemption for ${camp.name}`, incError);
            }
        }

        // 7. [REFERRAL] Create referral tracking record
        if (referralData) {
            const { error: refError } = await supabase
                .from('referrals')
                .insert({
                    referrer_id: referralData.referrerId,
                    referee_id: userId,
                    booking_id: booking.booking_id,
                    program_id: referralData.programId,
                    status: 'PENDING_PAYMENT',
                    reward_amount: referralData.rewardAmount
                });

            if (refError) {
                console.error('[Referral] Failed to create referral record:', refError);
            } else {
                console.log(`[Referral] Tracking record created: ${referralData.referrerId} -> ${userId}`);
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
                // Return reward items list for UI (optional, but good for confirmation)
                rewards: campaignsToIncrement.map(c => c.reward_item).filter(Boolean)
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
