// supabase/functions/open-match/index.ts
// Edge Function: สร้าง Open Match (ห้องประกาศหาคนแจม)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";
import { pushMessage } from "../_shared/lineClient.ts";

console.log("Open Match Function Started");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body = await req.json();
        const { action } = body;

        // ─── POST: สร้าง Open Match ────────────────────────────────
        if (req.method === 'POST' && action === 'create') {
            const { bookingId, userId, hostTeamSize, slotsTotal, skillLevel, note } = body;

            // 1. Validate input
            if (!bookingId || !userId || !hostTeamSize || !slotsTotal) {
                throw new Error('Missing required fields: bookingId, userId, hostTeamSize, slotsTotal');
            }

            // ─── [BETA GATE] เปิดให้เฉพาะ test users ───
            const BETA_USER_IDS = [
                'Ua636ab14081b483636896549d2026398',
                'Uf5d3d661f3d0a7150a814471e1a3adad',
            ];
            if (!BETA_USER_IDS.includes(userId)) {
                throw new Error('ฟีเจอร์ "เปิดตี้หาทีมแจม" ยังไม่เปิดให้ใช้งานในขณะนี้ กรุณารอการประกาศเปิดใช้งานอย่างเป็นทางการ');
            }
            // ─── [END BETA GATE] ──────────────────────────

            if (hostTeamSize < 1 || hostTeamSize > 30) throw new Error('hostTeamSize must be 1-30');
            if (slotsTotal < 1 || slotsTotal > 20) throw new Error('slotsTotal must be 1-20');

            // 2. ตรวจสอบว่า booking มีจริงและ status = confirmed
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .select('booking_id, user_id, status, price_total_thb, deposit_amount, payment_status, payment_method, date, time_from, time_to, field_no, display_name')
                .eq('booking_id', String(bookingId))
                .single();

            if (bookingError || !booking) throw new Error('Booking not found');
            if (booking.status !== 'confirmed') throw new Error('Booking must be confirmed before opening a match');
            if (booking.user_id !== userId) throw new Error('You are not the owner of this booking');

            // 2.5 ตรวจสอบว่ามีมัดจำในระบบแล้ว (ต้องจ่ายผ่าน Stripe ก่อนเปิดตี้)
            const hasDeposit = booking.payment_status === 'deposit_paid' || booking.payment_status === 'paid';
            if (!hasDeposit) {
                throw new Error('กรุณาจ่ายมัดจำก่อนเปิดตี้ (ชำระผ่าน QR PromptPay ในหน้าตั้งค่า)');
            }

            // 3. ตรวจสอบว่ายังไม่มี open match สำหรับ booking นี้
            const { data: existingMatch } = await supabase
                .from('open_matches')
                .select('id')
                .eq('booking_id', String(bookingId))
                .in('status', ['open', 'full'])
                .maybeSingle();

            if (existingMatch) throw new Error('คิวจองนี้มีการเปิดหาตี้อยู่แล้ว (ไม่สามารถเปิดซ้ำได้)');

            // 4. คำนวณ deposit_per_joiner (Auto-Split)
            const totalPrice = booking.price_total_thb || 0;
            const totalPlayers = hostTeamSize + slotsTotal;
            const depositPerJoiner = Math.ceil(totalPrice / totalPlayers);

            if (depositPerJoiner <= 0) throw new Error('Calculated deposit is zero. Check booking price.');

            // 5. คำนวณ expires_at (30 นาทีก่อนเวลาเล่น)
            const [h, m] = (booking.time_from || '18:00').split(':').map(Number);
            const matchDate = new Date(`${booking.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`);
            const expiresAt = new Date(matchDate.getTime() - (30 * 60 * 1000)); // 30 mins before

            // ถ้า expires_at อยู่ในอดีต ให้ set เป็น 15 นาทีจากตอนนี้เป็นขั้นต่ำ
            const now = new Date();
            if (expiresAt <= now) {
                expiresAt.setTime(now.getTime() + 15 * 60 * 1000);
            }

            // 6. Insert open_matches record
            const { data: match, error: insertError } = await supabase
                .from('open_matches')
                .insert({
                    booking_id: String(bookingId),
                    host_user_id: userId,
                    host_team_size: hostTeamSize,
                    slots_total: slotsTotal,
                    slots_filled: 0,
                    deposit_per_joiner: depositPerJoiner,
                    deposit_mode: 'auto',
                    note: note || null,
                    skill_level: skillLevel || 'casual',
                    status: 'open',
                    host_consent_at: new Date().toISOString(),
                    expires_at: expiresAt.toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (insertError) {
                console.error('[Open Match] Insert error:', insertError);
                throw new Error(`Failed to create match: ${insertError.message}`);
            }

            console.log(`[Open Match] Created: ${match.id} | Booking: ${bookingId} | Deposit: ${depositPerJoiner}/person | Slots: ${slotsTotal}`);

            // 7. ดึงข้อมูล field สำหรับ notification
            const { data: fieldData } = await supabase
                .from('fields')
                .select('label')
                .eq('id', booking.field_no)
                .single();

            return new Response(JSON.stringify({
                success: true,
                match: {
                    id: match.id,
                    bookingId: match.booking_id,
                    depositPerJoiner: match.deposit_per_joiner,
                    slotsTotal: match.slots_total,
                    skillLevel: match.skill_level,
                    expiresAt: match.expires_at,
                    fieldLabel: fieldData?.label || `สนาม ${booking.field_no}`,
                    date: booking.date,
                    timeFrom: booking.time_from,
                    timeTo: booking.time_to,
                    totalPrice: totalPrice,
                    hostTeamSize: hostTeamSize,
                    totalPlayers: totalPlayers,
                }
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ─── POST: ดึงข้อมูล Open Matches (สำหรับ Match Board) ──────
        if (req.method === 'POST' && action === 'list') {
            const { dateFilter, userId: viewerUserId } = body;

            let query = supabase
                .from('open_matches')
                .select(`
                    *,
                    booking:bookings!booking_id (
                        booking_id, date, time_from, time_to, field_no, price_total_thb, display_name
                    )
                `)
                .eq('status', 'open')
                .order('created_at', { ascending: false });

            const { data: matches, error: listError } = await query;

            if (listError) throw new Error(`Failed to list matches: ${listError.message}`);

            // Enrich with field labels
            const fieldIds = [...new Set((matches || []).map((m: any) => m.booking?.field_no).filter(Boolean))];
            const { data: fields } = await supabase.from('fields').select('id, label').in('id', fieldIds);
            const fieldMap: Record<number, string> = {};
            (fields || []).forEach((f: any) => { fieldMap[f.id] = f.label; });

            const enriched = (matches || []).map((m: any) => ({
                ...m,
                fieldLabel: fieldMap[m.booking?.field_no] || `สนาม ${m.booking?.field_no}`,
            }));

            return new Response(JSON.stringify({ success: true, matches: enriched }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ─── POST: ดึงข้อมูล match เดียว (detail) ───────────────────
        if (req.method === 'POST' && action === 'detail') {
            const { matchId } = body;
            if (!matchId) throw new Error('Missing matchId');

            const { data: match, error: detailError } = await supabase
                .from('open_matches')
                .select(`
                    *,
                    booking:bookings!booking_id (
                        booking_id, date, time_from, time_to, field_no, price_total_thb, display_name, deposit_amount
                    ),
                    joiners:match_joiners (
                        id, user_id, status, deposit_paid, joined_at
                    )
                `)
                .eq('id', matchId)
                .single();

            if (detailError || !match) throw new Error('Match not found');

            // Enrich with field label
            const { data: field } = await supabase.from('fields').select('label').eq('id', match.booking?.field_no).single();

            // Enrich joiners with profile info
            const joinerUserIds = (match.joiners || []).map((j: any) => j.user_id);
            let joinerProfiles: Record<string, any> = {};
            if (joinerUserIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('user_id, team_name, phone_number')
                    .in('user_id', joinerUserIds);
                (profiles || []).forEach((p: any) => { joinerProfiles[p.user_id] = p; });
            }

            const enrichedJoiners = (match.joiners || []).map((j: any) => ({
                ...j,
                profile: joinerProfiles[j.user_id] || null,
            }));

            return new Response(JSON.stringify({
                success: true,
                match: {
                    ...match,
                    fieldLabel: field?.label || `สนาม ${match.booking?.field_no}`,
                    joiners: enrichedJoiners,
                }
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ─── POST: Admin Force Cancel ──────────────────────────────
        if (req.method === 'POST' && action === 'force_cancel') {
            const { matchId, reason } = body;
            if (!matchId) throw new Error('Missing matchId');

            const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';

            // 1. ดึงข้อมูล match + joiners
            const { data: match, error: matchError } = await supabase
                .from('open_matches')
                .select('*, joiners:match_joiners(*)')
                .eq('id', matchId)
                .single();

            if (matchError || !match) throw new Error('Match not found');
            if (match.status === 'cancelled') throw new Error('Match already cancelled');

            // 2. Cancel match
            await supabase
                .from('open_matches')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', matchId);

            // 3. Refund joiners (หัก 15% ค่าธรรมเนียม — ใช้ยอดจริงจาก Stripe)
            const refundResults: any[] = [];
            for (const joiner of (match.joiners || [])) {
                if (joiner.status === 'joined' && joiner.stripe_payment_intent_id && STRIPE_SECRET_KEY) {
                    try {
                        // ดึงยอดจริงที่ Stripe ชาร์จ
                        const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${joiner.stripe_payment_intent_id}`, {
                            headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
                        });
                        const piData = await piRes.json();
                        const actualCharged = piData.amount_received || piData.amount || 0; // satang

                        if (actualCharged <= 0) {
                            console.log(`[Open Match] Joiner ${joiner.user_id}: no charge found, skipping refund`);
                            continue;
                        }

                        // หัก 15% จากยอดจริง
                        const feeSatang = Math.ceil(actualCharged * 0.15);
                        const refundSatang = actualCharged - feeSatang;

                        if (refundSatang > 0) {
                            const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                },
                                body: new URLSearchParams({
                                    'payment_intent': joiner.stripe_payment_intent_id,
                                    'amount': refundSatang.toString(),
                                }).toString(),
                            });

                            const refundData = await refundRes.json();
                            if (refundData.error) {
                                console.error(`[Open Match] Stripe refund error for joiner ${joiner.user_id}:`, refundData.error);
                                refundResults.push({ userId: joiner.user_id, error: refundData.error.message });
                                continue;
                            }

                            const refundTHB = refundSatang / 100;
                            const feeTHB = feeSatang / 100;
                            console.log(`[Open Match] Refund for joiner ${joiner.user_id}: ${refundTHB} THB (fee: ${feeTHB} THB) | Stripe: ${refundData.id}`);

                            // Update joiner status
                            await supabase
                                .from('match_joiners')
                                .update({ status: 'refunded' })
                                .eq('id', joiner.id);

                            refundResults.push({ userId: joiner.user_id, refunded: refundTHB, fee: feeTHB });

                            // Notify joiner via LINE
                            try {
                                await pushMessage(joiner.user_id, {
                                    type: 'text',
                                    text: `❌ การเปิดตี้ถูกยกเลิก\n\nเหตุผล: ${reason || 'เหตุสุดวิสัย'}\n\n💰 คืนเงิน ฿${refundTHB} (หัก 15% ค่าธรรมเนียม ฿${feeTHB})\n\nเงินจะคืนเข้าบัญชีภายใน 5-10 วันทำการ ขออภัยในความไม่สะดวกครับ 🙏`,
                                });
                            } catch (lineErr) {
                                console.error(`[Open Match] LINE notify error for joiner ${joiner.user_id}:`, lineErr);
                            }
                        }
                    } catch (refundErr) {
                        console.error(`[Open Match] Stripe refund error for joiner ${joiner.user_id}:`, refundErr);
                        refundResults.push({ userId: joiner.user_id, error: String(refundErr) });
                    }
                }
            }

            // 4. Refund Host (หัก 15% ค่าธรรมเนียม — ใช้ยอดจริงจาก Stripe)
            const { data: booking } = await supabase
                .from('bookings')
                .select('deposit_amount, stripe_payment_intent_id, user_id')
                .eq('booking_id', match.booking_id)
                .single();

            if (booking?.stripe_payment_intent_id && STRIPE_SECRET_KEY) {
                try {
                    // ดึงยอดจริงที่ Stripe ชาร์จ
                    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${booking.stripe_payment_intent_id}`, {
                        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
                    });
                    const piData = await piRes.json();
                    const actualCharged = piData.amount_received || piData.amount || 0; // satang

                    if (actualCharged > 0) {
                        const feeSatang = Math.ceil(actualCharged * 0.15);
                        const refundSatang = actualCharged - feeSatang;

                        if (refundSatang > 0) {
                            const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                },
                                body: new URLSearchParams({
                                    'payment_intent': booking.stripe_payment_intent_id,
                                    'amount': refundSatang.toString(),
                                }).toString(),
                            });

                            const refundData = await refundRes.json();
                            if (refundData.error) {
                                console.error('[Open Match] Host refund Stripe error:', refundData.error);
                            } else {
                                const hostRefundTHB = refundSatang / 100;
                                const hostFeeTHB = feeSatang / 100;
                                console.log(`[Open Match] Host refund: ${hostRefundTHB} THB (fee: ${hostFeeTHB} THB) | Stripe: ${refundData.id}`);
                            }
                        }
                    }
                } catch (hostRefundErr) {
                    console.error('[Open Match] Host refund error:', hostRefundErr);
                }

                // Cancel the booking itself
                await supabase
                    .from('bookings')
                    .update({
                        status: 'cancelled',
                        admin_note: `[Force Cancel - Open Match] ${reason || 'เหตุสุดวิสัย'}`,
                        is_refunded: true,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('booking_id', match.booking_id);

                // Notify Host
                try {
                    // ดึงยอดคืนจริงเพื่อแจ้ง HOST
                    const piRes2 = await fetch(`https://api.stripe.com/v1/payment_intents/${booking.stripe_payment_intent_id}`, {
                        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
                    });
                    const piData2 = await piRes2.json();
                    const hostActual = piData2.amount_received || piData2.amount || 0;
                    const hostFeeFinal = Math.ceil(hostActual * 0.15);
                    const hostRefundFinal = (hostActual - hostFeeFinal) / 100;
                    const hostFeeFinalTHB = hostFeeFinal / 100;

                    await pushMessage(match.host_user_id, {
                        type: 'text',
                        text: `❌ การเปิดตี้ถูกยกเลิก\n\nเหตุผล: ${reason || 'เหตุสุดวิสัย'}\n\n💰 คืนเงินมัดจำ ฿${hostRefundFinal} (หัก 15% ค่าธรรมเนียม ฿${hostFeeFinalTHB})\n\nเงินจะคืนเข้าบัญชีภายใน 5-10 วันทำการ ขออภัยในความไม่สะดวกครับ 🙏`,
                    });
                } catch (lineErr) {
                    console.error('[Open Match] Host LINE notify error:', lineErr);
                }
            }

            return new Response(JSON.stringify({
                success: true,
                message: 'Match force cancelled with refunds',
                refunds: refundResults,
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        throw new Error(`Unknown action: ${action}`);

    } catch (error: any) {
        console.error('[Open Match Error]:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
