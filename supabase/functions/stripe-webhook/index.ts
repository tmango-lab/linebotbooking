// supabase/functions/stripe-webhook/index.ts
// Handles Stripe webhook events for payment confirmation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";
import { pushMessage } from "../_shared/lineClient.ts";

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';

console.log("Stripe Webhook Function Started");

/**
 * Verify Stripe webhook signature using crypto.subtle (Deno-native)
 */
async function verifyStripeSignature(
    payload: string,
    sigHeader: string,
    secret: string
): Promise<boolean> {
    if (!secret) {
        console.warn('[Stripe Webhook] No webhook secret configured, skipping verification');
        return true;
    }

    try {
        // Parse the signature header
        const parts = sigHeader.split(',');
        let timestamp = '';
        let signature = '';

        for (const part of parts) {
            const [key, value] = part.split('=');
            if (key === 't') timestamp = value;
            if (key === 'v1') signature = value;
        }

        if (!timestamp || !signature) {
            console.error('[Stripe Webhook] Missing timestamp or signature');
            return false;
        }

        // Check timestamp tolerance (5 minutes)
        const currentTime = Math.floor(Date.now() / 1000);
        if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
            console.error('[Stripe Webhook] Timestamp too old');
            return false;
        }

        // Compute expected signature
        const signedPayload = `${timestamp}.${payload}`;
        const encoder = new TextEncoder();

        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signed = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(signedPayload)
        );

        // Convert to hex string
        const expectedSignature = Array.from(new Uint8Array(signed))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return expectedSignature === signature;
    } catch (err) {
        console.error('[Stripe Webhook] Signature verification error:', err);
        return false;
    }
}

serve(async (req) => {
    // Stripe webhooks always use POST
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const body = await req.text();
        const sigHeader = req.headers.get('stripe-signature') || '';

        // 1. Verify Stripe Signature
        const isValid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET);
        if (!isValid) {
            console.error('[Stripe Webhook] Invalid signature');
            return new Response('Invalid signature', { status: 401 });
        }

        // 2. Parse Event
        const event = JSON.parse(body);
        console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

        // 3. Handle payment_intent.succeeded
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const metadataType = paymentIntent.metadata?.type;

            // ─── [OPEN MATCH] Handle Joiner deposit payment ───────
            if (metadataType === 'match_join') {
                const matchId = paymentIntent.metadata?.match_id;
                const joinUserId = paymentIntent.metadata?.user_id;
                const depositPaid = paymentIntent.amount / 100;

                console.log(`[Stripe Webhook] Match Join payment: match=${matchId} user=${joinUserId} amount=${depositPaid}`);

                if (!matchId || !joinUserId) {
                    console.error('[Stripe Webhook] Missing match_id or user_id in match_join metadata');
                    return new Response('Missing match metadata', { status: 400 });
                }

                // Find the joiner record by match_id + user_id
                const { data: joiner } = await supabase
                    .from('match_joiners')
                    .select('id, match_id')
                    .eq('match_id', matchId)
                    .eq('user_id', joinUserId)
                    .eq('status', 'pending_payment')
                    .maybeSingle();

                if (!joiner) {
                    console.error(`[Stripe Webhook] No pending joiner found for match=${matchId} user=${joinUserId}`);
                    return new Response(JSON.stringify({ received: true, warning: 'No pending joiner' }), { status: 200 });
                }

                // Atomic confirm via RPC
                const { data: confirmResult, error: confirmError } = await supabase.rpc('confirm_match_joiner', {
                    p_joiner_id: joiner.id,
                });

                if (confirmError) {
                    console.error('[Stripe Webhook] confirm_match_joiner RPC error:', confirmError);
                    return new Response('RPC error', { status: 500 });
                }

                console.log(`[Stripe Webhook] Joiner confirmed:`, confirmResult);

                // Notify Joiner via LINE
                try {
                    const fieldName = paymentIntent.metadata?.field_name || 'สนาม';
                    const matchDate = paymentIntent.metadata?.date || '';
                    await pushMessage(joinUserId, {
                        type: 'text',
                        text: `✅ เข้าร่วมสำเร็จ!\n\n${fieldName}\n📅 ${matchDate}\n💰 มัดจำ ${depositPaid} บาท\n\nขอบคุณที่เข้าร่วม แล้วพบกันที่สนามนะครับ!`,
                    });
                } catch (lineErr) {
                    console.error('[Stripe Webhook] Joiner LINE notify error:', lineErr);
                }

                // Notify Host via LINE
                if (confirmResult?.host_user_id) {
                    try {
                        const customerName = paymentIntent.metadata?.customer_name || 'ผู้เล่นใหม่';
                        const slotsInfo = `${confirmResult.slots_filled}/${confirmResult.slots_total}`;
                        const fullMsg = confirmResult.is_full
                            ? `\n\n🎉 ครบแล้ว! พบกันทุกคนที่สนามนะครับ!`
                            : `\n\n⏳ ยังขาดอีก ${confirmResult.slots_total - confirmResult.slots_filled} คน`;

                        await pushMessage(confirmResult.host_user_id, {
                            type: 'text',
                            text: `⚽ มีคนเข้าร่วมแจมแล้ว!\n\n👤 ${customerName}\n💰 จ่ายมัดจำ ${depositPaid} บาท\n📊 เข้าร่วมแล้ว ${slotsInfo} คน${fullMsg}`,
                        });
                    } catch (lineErr) {
                        console.error('[Stripe Webhook] Host LINE notify error:', lineErr);
                    }
                }

                return new Response(JSON.stringify({ received: true }), { status: 200 });
            }
            // ─── [END OPEN MATCH] ────────────────────────────────

            const bookingId = paymentIntent.metadata?.booking_id;

            if (!bookingId) {
                console.error('[Stripe Webhook] No booking_id in metadata');
                return new Response('No booking_id', { status: 400 });
            }

            const depositAmount = paymentIntent.amount / 100;
            const totalPrice = parseFloat(paymentIntent.metadata?.total_price || '0');
            const remainingBalance = Math.max(0, totalPrice - depositAmount);

            console.log(`[Stripe Webhook] Payment succeeded for booking: ${bookingId} | Deposit: ${depositAmount} THB | Total: ${totalPrice} THB | Remaining: ${remainingBalance} THB`);

            // 4. Update booking status (deposit_paid = deposit received, remaining paid at field)
            const { data: booking, error: updateError } = await supabase
                .from('bookings')
                .update({
                    payment_status: 'deposit_paid',
                    status: 'confirmed',
                    updated_at: new Date().toISOString(),
                })
                .eq('booking_id', bookingId)
                .select()
                .single();

            if (updateError) {
                console.error('[Stripe Webhook] DB update error:', updateError);
                return new Response('DB update failed', { status: 500 });
            }

            console.log(`[Stripe Webhook] Booking ${bookingId} updated to deposit_paid/confirmed`);

            // 5. Increment campaign redemption counts (if applicable)
            if (booking) {
                // Fetch coupons used for this booking
                const { data: usedCoupons } = await supabase
                    .from('user_coupons')
                    .select('*, campaigns(*)')
                    .eq('booking_id', bookingId)
                    .eq('status', 'USED');

                if (usedCoupons && usedCoupons.length > 0) {
                    for (const coupon of usedCoupons) {
                        if (coupon.campaigns) {
                            const { error: incError } = await supabase.rpc('increment_campaign_redemption', {
                                target_campaign_id: coupon.campaigns.id,
                            });
                            if (incError) console.error(`[Stripe Webhook] Campaign increment error:`, incError);
                            else console.log(`[Stripe Webhook] Campaign ${coupon.campaigns.name} redemption incremented`);
                        }
                    }
                }
            }

            // 6. Send LINE notification
            if (booking?.user_id) {
                try {
                    const fieldLabel = (await supabase.from('fields').select('label').eq('id', booking.field_no).single()).data?.label || `Field ${booking.field_no}`;

                    const confirmFlex = {
                        type: 'flex',
                        altText: '✅ ชำระเงินสำเร็จ',
                        contents: {
                            type: 'bubble',
                            size: 'kilo',
                            header: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '✅ ชำระเงินสำเร็จ!',
                                        weight: 'bold',
                                        size: 'lg',
                                        color: '#1DB446',
                                    },
                                ],
                                backgroundColor: '#F0FFF0',
                                paddingAll: 'lg',
                            },
                            body: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: `${fieldLabel}`,
                                        weight: 'bold',
                                        size: 'md',
                                    },
                                    {
                                        type: 'text',
                                        text: `📅 ${booking.date}`,
                                        size: 'sm',
                                        color: '#666666',
                                        margin: 'sm',
                                    },
                                    {
                                        type: 'text',
                                        text: `⏰ ${booking.time_from} - ${booking.time_to}`,
                                        size: 'sm',
                                        color: '#666666',
                                        margin: 'sm',
                                    },
                                    {
                                        type: 'separator',
                                        margin: 'lg',
                                    },
                                    {
                                        type: 'box',
                                        layout: 'horizontal',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: 'ค่ามัดจำ (Stripe)',
                                                size: 'sm',
                                                color: '#555555',
                                            },
                                            {
                                                type: 'text',
                                                text: `฿${depositAmount}`,
                                                size: 'sm',
                                                color: '#1DB446',
                                                weight: 'bold',
                                                align: 'end',
                                            },
                                        ],
                                        margin: 'lg',
                                    },
                                    {
                                        type: 'box',
                                        layout: 'horizontal',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: 'ยอดคงเหลือ (หน้าสนาม)',
                                                size: 'sm',
                                                color: '#555555',
                                            },
                                            {
                                                type: 'text',
                                                text: `฿${remainingBalance}`,
                                                size: 'sm',
                                                color: '#FF6B35',
                                                weight: 'bold',
                                                align: 'end',
                                            },
                                        ],
                                        margin: 'sm',
                                    },
                                    {
                                        type: 'text',
                                        text: 'ชำระมัดจำผ่าน Stripe PromptPay',
                                        size: 'xs',
                                        color: '#AAAAAA',
                                        margin: 'md',
                                    },
                                ],
                                paddingAll: 'lg',
                            },
                        },
                    };

                    await pushMessage(booking.user_id, confirmFlex);
                    console.log(`[Stripe Webhook] LINE notification sent to ${booking.user_id}`);

                    // ─── [OPEN MATCH] ส่ง Flex ถามว่าจะเปิดตี้หาทีมแจมไหม ───
                    try {
                        const LIFF_ID = Deno.env.get('LIFF_ID') || '2009013698-RcmHMN8h';
                        const setupMatchUrl = `https://liff.line.me/${LIFF_ID}/?redirect=setup-match&bookingId=${bookingId}`;

                        const openMatchFlex = {
                            type: 'flex',
                            altText: '⚽ อยากเปิดตี้หาทีมแจมไหม?',
                            contents: {
                                type: 'bubble',
                                size: 'kilo',
                                body: {
                                    type: 'box',
                                    layout: 'vertical',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '⚽ เปิดตี้หาทีมแจม?',
                                            weight: 'bold',
                                            size: 'lg',
                                            color: '#333333',
                                        },
                                        {
                                            type: 'text',
                                            text: 'ถ้ายังขาดคน กดเปิดตี้ได้เลย! ค่าสนามหารเท่ากันอัตโนมัติ 💰',
                                            size: 'sm',
                                            color: '#888888',
                                            wrap: true,
                                            margin: 'md',
                                        },
                                    ],
                                    paddingAll: 'lg',
                                },
                                footer: {
                                    type: 'box',
                                    layout: 'vertical',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'button',
                                            style: 'primary',
                                            color: '#06C755',
                                            action: {
                                                type: 'uri',
                                                label: '📢 เปิดตี้หาทีมแจม',
                                                uri: setupMatchUrl,
                                            },
                                        },
                                        {
                                            type: 'button',
                                            style: 'link',
                                            action: {
                                                type: 'message',
                                                label: 'ไม่ต้อง ขอบคุณ',
                                                text: 'ไม่เปิดตี้',
                                            },
                                        },
                                    ],
                                    paddingAll: 'lg',
                                },
                            },
                        };

                        await pushMessage(booking.user_id, openMatchFlex);
                        console.log(`[Stripe Webhook] Open Match prompt sent to ${booking.user_id}`);
                    } catch (matchPromptErr) {
                        console.error('[Stripe Webhook] Open Match prompt error:', matchPromptErr);
                    }
                    // ─── [END OPEN MATCH] ───────────────────────────────

                } catch (lineErr) {
                    console.error('[Stripe Webhook] LINE notification error:', lineErr);
                    // Non-blocking
                }
            }

            // 7. [REFERRAL] Process referral reward
            try {
                const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
                console.log(`[Stripe Webhook] Triggering referral reward for ${bookingId}...`);
                const res = await fetch(`${supabaseUrl}/functions/v1/process-referral-reward`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`
                    },
                    body: JSON.stringify({ bookingId })
                });
                console.log(`[Stripe Webhook] Referral reward triggered for ${bookingId}: ${res.status}`);
            } catch (refErr) {
                console.error('[Stripe Webhook] Referral reward non-blocking error:', refErr);
            }

            return new Response(JSON.stringify({ received: true }), { status: 200 });
        }

        // Handle payment_intent.payment_failed
        if (event.type === 'payment_intent.payment_failed') {
            const paymentIntent = event.data.object;
            const bookingId = paymentIntent.metadata?.booking_id;

            if (bookingId) {
                console.log(`[Stripe Webhook] Payment failed for booking: ${bookingId}`);
                
                // Fetch the booking first to check its current status
                const { data: currentBooking, error: fetchError } = await supabase
                    .from('bookings')
                    .select('payment_status')
                    .eq('booking_id', bookingId)
                    .single();

                if (!fetchError && currentBooking) {
                    // Only update to failed if it hasn't been paid already
                    if (currentBooking.payment_status !== 'paid' && currentBooking.payment_status !== 'deposit_paid') {
                        await supabase
                            .from('bookings')
                            .update({
                                payment_status: 'failed',
                                updated_at: new Date().toISOString(),
                            })
                            .eq('booking_id', bookingId);
                        console.log(`[Stripe Webhook] Booking ${bookingId} payment_status updated to failed`);
                    } else {
                        console.log(`[Stripe Webhook] Ignored payment_failed for ${bookingId} as it is already ${currentBooking.payment_status}`);
                    }
                }
            }

            return new Response(JSON.stringify({ received: true }), { status: 200 });
        }

        // Acknowledge other events
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        return new Response(JSON.stringify({ received: true }), { status: 200 });

    } catch (error: any) {
        console.error('[Stripe Webhook Error]:', error.message);
        return new Response(`Webhook Error: ${error.message}`, { status: 500 });
    }
});
