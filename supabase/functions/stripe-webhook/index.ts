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
            const bookingId = paymentIntent.metadata?.booking_id;

            if (!bookingId) {
                console.error('[Stripe Webhook] No booking_id in metadata');
                return new Response('No booking_id', { status: 400 });
            }

            console.log(`[Stripe Webhook] Payment succeeded for booking: ${bookingId} | Amount: ${paymentIntent.amount / 100} THB`);

            // 4. Update booking status
            const { data: booking, error: updateError } = await supabase
                .from('bookings')
                .update({
                    payment_status: 'paid',
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

            console.log(`[Stripe Webhook] Booking ${bookingId} updated to paid/confirmed`);

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
                                                text: 'ยอดชำระ',
                                                size: 'sm',
                                                color: '#555555',
                                            },
                                            {
                                                type: 'text',
                                                text: `฿${booking.price_total_thb}`,
                                                size: 'sm',
                                                color: '#1DB446',
                                                weight: 'bold',
                                                align: 'end',
                                            },
                                        ],
                                        margin: 'lg',
                                    },
                                    {
                                        type: 'text',
                                        text: 'ชำระผ่าน Stripe PromptPay',
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
                } catch (lineErr) {
                    console.error('[Stripe Webhook] LINE notification error:', lineErr);
                    // Non-blocking
                }
            }

            return new Response(JSON.stringify({ received: true }), { status: 200 });
        }

        // Handle payment_intent.payment_failed
        if (event.type === 'payment_intent.payment_failed') {
            const paymentIntent = event.data.object;
            const bookingId = paymentIntent.metadata?.booking_id;

            if (bookingId) {
                console.log(`[Stripe Webhook] Payment failed for booking: ${bookingId}`);
                // Optionally update booking status
                await supabase
                    .from('bookings')
                    .update({
                        payment_status: 'failed',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('booking_id', bookingId);
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
