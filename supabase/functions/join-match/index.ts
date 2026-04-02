// supabase/functions/join-match/index.ts
// Edge Function: Joiner เข้าร่วม Open Match + สร้าง Stripe PaymentIntent

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";

console.log("Join Match Function Started");

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { matchId, userId } = await req.json();

        // 1. Validate
        if (!matchId || !userId) throw new Error('Missing matchId or userId');

        // 2. ดึงข้อมูล match
        const { data: match, error: matchError } = await supabase
            .from('open_matches')
            .select('*, booking:bookings!booking_id(booking_id, date, time_from, time_to, field_no, price_total_thb, display_name)')
            .eq('id', matchId)
            .single();

        if (matchError || !match) throw new Error('Match not found');
        if (match.status !== 'open') throw new Error('ห้องนี้ไม่ได้เปิดรับอีกแล้ว');
        if (match.host_user_id === userId) throw new Error('Host ไม่สามารถเข้าร่วมห้องตัวเองได้');

        // 3. ตรวจสอบว่า match ยังไม่ expire
        if (new Date(match.expires_at) <= new Date()) {
            await supabase.from('open_matches').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', matchId);
            throw new Error('ห้องนี้หมดเวลาแล้ว');
        }

        // 4. ตรวจสอบ profile ของ Joiner
        const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, team_name, phone_number')
            .eq('user_id', userId)
            .maybeSingle();

        if (!profile) throw new Error('กรุณาลงทะเบียนก่อนเข้าร่วม');

        const depositAmount = match.deposit_per_joiner;

        // ─── [TEST MODE] Override deposit for test users ───
        const TEST_USER_IDS = [
            'Ua636ab14081b483636896549d2026398',
            'Uf5d3d661f3d0a7150a814471e1a3adad',
        ];
        const stripeChargeAmount = TEST_USER_IDS.includes(userId)
            ? 11  // Test users pay only 11 THB
            : depositAmount;
        if (stripeChargeAmount !== depositAmount) {
            console.log(`[Join Match] ⚡ TEST MODE: User ${userId} → charge ${stripeChargeAmount} THB instead of ${depositAmount} THB`);
        }
        // ─── [END TEST MODE] ──────────────────────────────

        const amountInSatang = Math.round(stripeChargeAmount * 100);

        // 5. สร้าง Stripe PaymentIntent
        if (!STRIPE_SECRET_KEY) throw new Error('Stripe not configured');

        // Field label for metadata
        const { data: fieldData } = await supabase
            .from('fields')
            .select('label')
            .eq('id', match.booking?.field_no)
            .single();

        const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'amount': amountInSatang.toString(),
                'currency': 'thb',
                'payment_method_types[]': 'promptpay',
                'metadata[type]': 'match_join',
                'metadata[match_id]': matchId,
                'metadata[user_id]': userId,
                'metadata[booking_id]': match.booking_id,
                'metadata[deposit_amount]': depositAmount.toString(),
                'metadata[field_name]': fieldData?.label || `สนาม ${match.booking?.field_no}`,
                'metadata[date]': match.booking?.date || '',
                'metadata[customer_name]': profile.team_name || '',
            }).toString(),
        });

        if (!stripeRes.ok) {
            const errBody = await stripeRes.text();
            console.error('[Join Match] Stripe error:', stripeRes.status, errBody);
            throw new Error(`Stripe error: ${stripeRes.status}`);
        }

        const paymentIntent = await stripeRes.json();
        console.log(`[Join Match] PI created: ${paymentIntent.id} | Match: ${matchId} | User: ${userId} | Amount: ${depositAmount} THB`);

        // 6. ใช้ atomic function เพื่อจอง slot (race-condition safe)
        const { data: joinResult, error: joinError } = await supabase.rpc('try_join_match', {
            p_match_id: matchId,
            p_user_id: userId,
            p_deposit: depositAmount,
            p_stripe_pi: paymentIntent.id,
        });

        if (joinError) {
            console.error('[Join Match] RPC error:', joinError);
            throw new Error(`Failed to join: ${joinError.message}`);
        }

        if (!joinResult?.success) {
            // ยกเลิก PI ถ้า join ไม่สำเร็จ
            try {
                await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntent.id}/cancel`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
                });
            } catch (e) { /* silent */ }
            throw new Error(joinResult?.error || 'Cannot join match');
        }

        console.log(`[Join Match] Slot reserved: joiner_id=${joinResult.joiner_id} | Waiting for payment`);

        return new Response(JSON.stringify({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: depositAmount,
            joinerId: joinResult.joiner_id,
            publicKey: Deno.env.get('STRIPE_PUBLIC_KEY') || '',
            match: {
                id: match.id,
                fieldLabel: fieldData?.label || `สนาม ${match.booking?.field_no}`,
                date: match.booking?.date,
                timeFrom: match.booking?.time_from,
                timeTo: match.booking?.time_to,
                hostName: match.booking?.display_name,
                skillLevel: match.skill_level,
                note: match.note,
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Join Match Error]:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
