// supabase/functions/create-payment-intent/index.ts
// Creates a Stripe PaymentIntent for PromptPay QR payment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Create Payment Intent Function Started");

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { bookingId } = await req.json();

        if (!bookingId) {
            throw new Error('Missing bookingId');
        }

        // 1. Fetch booking from database
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('booking_id', bookingId)
            .single();

        if (bookingError || !booking) {
            throw new Error('Booking not found');
        }

        if (booking.payment_status === 'paid') {
            throw new Error('Booking already paid');
        }

        const totalPrice = booking.price_total_thb;
        if (!totalPrice || totalPrice <= 0) {
            throw new Error('Invalid amount');
        }

        // Fixed deposit amount: 200 THB
        // The remaining balance is paid in cash at the field
        const DEPOSIT_AMOUNT = 200;
        const depositAmount = Math.min(DEPOSIT_AMOUNT, totalPrice); // Don't charge more than total

        // 2. Create PaymentIntent via Stripe REST API
        // Amount is in smallest currency unit (satang for THB), so multiply by 100
        const amountInSatang = Math.round(depositAmount * 100);

        const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'amount': amountInSatang.toString(),
                'currency': 'thb',
                'payment_method_types[]': 'promptpay',
                'metadata[booking_id]': bookingId,
                'metadata[field_no]': booking.field_no?.toString() || '',
                'metadata[customer_name]': booking.display_name || '',
                'metadata[date]': booking.date || '',
                'metadata[deposit_amount]': depositAmount.toString(),
                'metadata[total_price]': totalPrice.toString(),
            }).toString(),
        });

        if (!stripeResponse.ok) {
            const errBody = await stripeResponse.text();
            console.error('[Stripe API Error]:', stripeResponse.status, errBody);
            throw new Error(`Stripe error: ${stripeResponse.status}`);
        }

        const paymentIntent = await stripeResponse.json();

        console.log(`[PaymentIntent Created] ID: ${paymentIntent.id} | Deposit: ${depositAmount} THB (Total: ${totalPrice} THB) | Booking: ${bookingId}`);

        // 3. Store the PaymentIntent ID in the booking for reference
        await supabase
            .from('bookings')
            .update({
                stripe_payment_intent_id: paymentIntent.id,
                updated_at: new Date().toISOString(),
            })
            .eq('booking_id', bookingId);

        // 4. Return client_secret to frontend
        return new Response(JSON.stringify({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: depositAmount,
            publicKey: Deno.env.get('STRIPE_PUBLIC_KEY') || '',
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Create PaymentIntent Error]:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
