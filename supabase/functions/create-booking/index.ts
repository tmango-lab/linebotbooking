
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

        // [Referral] Pre-validation
        let referralData: { referrerId: string; programId: string; discountPercent: number; rewardAmount: number } | null = null;
        if (referralCode) {
            if (!userId) {
                throw new Error("ต้องเข้าสู่ระบบเพื่อใช้รหัสแนะนำเพื่อน");
            }

            console.log(`[Referral] Validating code: ${referralCode}`);
            // Check prior usage STRICTLY before creating booking
            const { data: existingRef } = await supabase
                .from('referrals')
                .select('id')
                .eq('referee_id', userId)
                .maybeSingle();

            if (existingRef) {
                // If checking logic failed in frontend, block here
                console.warn(`[Referral Block] User ${userId} already referred. Blocking usage.`);
                // We don't throw error to block booking, but we remove the discount
                referralCode = null;
                adminNote += ` [Referral Skipped: Reuse Attempt]`;
            } else {
                // Standard Validation
                const { data: affiliate } = await supabase
                    .from('affiliates')
                    .select('user_id, status')
                    .eq('referral_code', referralCode)
                    .eq('status', 'APPROVED')
                    .maybeSingle();

                if (affiliate && affiliate.user_id !== userId) {
                    const { data: program } = await supabase
                        .from('referral_programs')
                        .select('id, discount_percent, reward_amount, end_date')
                        .eq('is_active', true)
                        .maybeSingle();

                    if (program && (!program.end_date || new Date(program.end_date) >= new Date())) {
                        referralData = {
                            referrerId: affiliate.user_id,
                            programId: program.id,
                            discountPercent: program.discount_percent || 50,
                            rewardAmount: program.reward_amount || 100
                        };
                        const refDiscount = Math.floor((originalPrice * referralData.discountPercent) / 100);
                        discountAmount += refDiscount;
                        finalPrice = Math.max(0, originalPrice - discountAmount);
                        isPromo = true;
                        console.log(`[Referral] Applied ${referralData.discountPercent}% discount: -${refDiscount} THB. Final: ${finalPrice}`);
                        adminNote = (adminNote || '') + ` [Referral] (-${refDiscount})`;
                    }
                }
            }
        }

        // 3. Process Coupon/Campaign (V2 Redemption Logic)
        let campaignsToIncrement: any[] = [];
        let usedCouponIds: string[] = [];

        if (usageCouponIds.length > 0) {
            // Fetch All Coupons using `in` filter
            const { data: coupons, error: couponError } = await supabase
                .from('user_coupons')
                .select('*, campaigns(*)')
                .in('id', usageCouponIds);

            if (couponError || !coupons) throw new Error('Invalid Coupons');

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
                /* ... Additional validations simplified for brevity, assume frontend checks mostly ... */

                // Micro-Conditions Validation
                if (campaign.min_spend && originalPrice < campaign.min_spend) throw new Error(`Min spend ${campaign.min_spend} required`);

                // Benefit Application
                if (campaign.reward_item) {
                    isPromo = true;
                    adminNote = (adminNote || '') + ` [REWARD: ${campaign.reward_item}]`;
                } else {
                    let amount = 0;
                    if (campaign.discount_amount > 0) {
                        amount = campaign.discount_amount;
                    } else if (campaign.discount_percent > 0) {
                        amount = Math.floor((originalPrice * campaign.discount_percent) / 100);
                        if (campaign.max_discount && campaign.max_discount > 0 && amount > campaign.max_discount) {
                            amount = campaign.max_discount;
                        }
                    }
                    discountAmount += amount; // Accumulate
                    adminNote = (adminNote || '') + ` [Coupon: ${campaign.name}] (-${amount})`;
                }
                campaignsToIncrement.push(campaign);
                usedCouponIds.push(coupon.id);
            }
            // Cap total discount
            if (discountAmount > originalPrice) discountAmount = originalPrice;
            finalPrice = Math.max(0, originalPrice - discountAmount);
        }

        // [Check Overlap]
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
                const startMin = startH * 60 + startM;
                const endMin = endH * 60 + endM;

                if (startMin < ebEndMin && endMin > ebStartMin) {
                    throw new Error(`สนามนี้ถูกจองแล้วในช่วงเวลา ${eb.time_from}-${eb.time_to}`);
                }
            }
        }

        // 4. Create Booking
        const isQR = paymentMethod === 'QR';
        const timeoutMinutes = 10;
        const timeoutAt = isQR ? new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString() : null;
        if (isQR) adminNote = (adminNote ? adminNote + ' | ' : '') + `[Deposit 200 THB Required]`;

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

        // Auto-register profile if it doesn't exist
        try {
            if (userId) {
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('user_id')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!existingProfile) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert({
                            user_id: userId,
                            team_name: customerName,
                            phone_number: phoneNumber,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });

                    if (profileError) {
                        console.error('[Profile Auto-Registration Error]', profileError);
                    } else {
                        console.log(`[Profile] Auto-registered new profile for user ${userId}`);
                    }
                }
            }
        } catch (profileCatchError) {
            console.error('[Profile Auto-Registration Exception]', profileCatchError);
        }

        // --- TRANSACTIONAL SAFETY BLOCK ---
        try {
            // 5. Mark Coupons as Used
            if (usedCouponIds.length > 0) {
                const { error: markError } = await supabase
                    .from('user_coupons')
                    .update({
                        status: 'USED',
                        used_at: new Date().toISOString(),
                        booking_id: booking.booking_id
                    })
                    .in('id', usedCouponIds);

                if (markError) throw new Error(`Failed to update coupons: ${markError.message}`);
            }

            // 6. Increment Campaign Redemption
            if (campaignsToIncrement.length > 0 && !isQR) {
                for (const camp of campaignsToIncrement) {
                    const { error: incError } = await supabase.rpc('increment_campaign_redemption', {
                        target_campaign_id: camp.id
                    });
                    if (incError) console.error(`Failed to increment campaign ${camp.id}`, incError);
                    // Non-critical, just log
                }
            }

            // 7. [REFERRAL] Create referral tracking
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
                    // CRITICAL: If we can't record the referral, we must FAIL the booking
                    // otherwise the user gets a discount without "using up" their referral eligibility.
                    throw new Error(`Failed to record referral: ${refError.message}`);
                }
                console.log(`[Referral] Tracking record created for ${userId}`);
            }

        } catch (postBookingError: any) {
            console.error('[CRITICAL] Post-booking operation failed. Rolling back booking...', postBookingError);

            // MANUAL ROLLBACK
            await supabase.from('bookings').delete().eq('booking_id', booking.booking_id);

            throw new Error(`Booking processing failed: ${postBookingError.message}. Please try again.`);
        }

        // 8. Notification (Only after everything is safe)
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
            }
        } catch (notifierErr) {
            console.error('[Notification Error]:', notifierErr);
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
