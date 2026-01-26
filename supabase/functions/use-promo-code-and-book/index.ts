// @ts-nocheck
// supabase/functions/use-promo-code-and-book/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { pushMessage } from '../_shared/lineClient.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helpers... (Keeping existing helpers)
function getFieldName(fieldId: number): string {
    const fieldNames: Record<number, string> = {
        1: 'สนาม 1 (5 คน)', 2: 'สนาม 2 (5 คน)', 3: 'สนาม 3 (7-8 คน)', 4: 'สนาม 4 (7 คน)', 5: 'สนาม 5 (7 คน)', 6: 'สนาม 6 (7 คน)',
    };
    return fieldNames[fieldId] || `สนาม ${fieldId}`;
}
function formatThaiDate(dateStr: string): string {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const date = new Date(dateStr);
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}
function formatBookingConfirmation(promo: any, customerName: string, phoneNumber: string): string {
    const fieldName = getFieldName(promo.field_id);
    const dateStr = formatThaiDate(promo.booking_date);
    const timeFrom = promo.time_from.substring(0, 5);
    const timeTo = promo.time_to.substring(0, 5);
    return `✅ การจองของคุณสำเร็จแล้ว!\n\n📍 สนาม: ${fieldName}\n📅 วันที่: ${dateStr}\n⏰ เวลา: ${timeFrom} - ${timeTo} (${promo.duration_h} ชม.)\n\n💰 ราคาเต็ม: ${promo.original_price.toLocaleString()} บาท\n🎟️ ส่วนลด: -${promo.discount_amount.toLocaleString()} บาท\n✨ ราคาสุทธิ: ${promo.final_price.toLocaleString()} บาท\n\n👤 ชื่อผู้จอง: ${customerName}\n📞 เบอร์โทร: ${phoneNumber}\n\nชำระเงินได้ที่สนาม\nหากต้องการยกเลิก กรุณาติดต่อ 083-914-4000`;
}
async function sendBookingNotification(userId: string, promo: any, customerName: string, phoneNumber: string) {
    try {
        await pushMessage(userId, { type: 'text', text: formatBookingConfirmation(promo, customerName, phoneNumber) });
        console.log(`[Notification] Sent to ${userId}`);
        return { success: true };
    } catch (e: any) {
        console.error(`[Notification] Failed:`, e);
        return { success: false, error: e.message };
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { promoCode, customerName, phoneNumber } = await req.json();

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Step 1: Validate promo code
        const { data: promo, error: promoError } = await supabase.from('promo_codes').select('*').eq('code', promoCode).single();
        if (promoError || !promo) return new Response(JSON.stringify({ error: 'ไม่พบโค้ดนี้ในระบบ' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (promo.status !== 'active') return new Response(JSON.stringify({ error: 'โค้ดนี้ไม่สามารถใช้งานได้แล้ว' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (new Date() > new Date(promo.expires_at)) return new Response(JSON.stringify({ error: 'โค้ดนี้หมดอายุแล้ว' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        // Step 2: Create booking in Matchday
        const matchdayToken = Deno.env.get('MATCHDAY_TOKEN')!;
        const FIELD_MAP: Record<number, number> = { 1: 2424, 2: 2425, 3: 2428, 4: 2426, 5: 2427, 6: 2429 };
        const matchdayCourtId = FIELD_MAP[promo.field_id];

        const timeFromHHMM = promo.time_from.substring(0, 5);
        const timeToHHMM = promo.time_to.substring(0, 5);

        const bookingPayload = {
            courts: [matchdayCourtId.toString()],
            time_start: `${promo.booking_date} ${timeFromHHMM}:00`,
            time_end: `${promo.booking_date} ${timeToHHMM}:00`,
            settings: { name: customerName, phone_number: phoneNumber, note: `Promo: ${promoCode} | Price: ${promo.final_price}` },
            payment: 'cash', method: 'fast-create', payment_multi: false, fixed_price: null, member_id: null, user_id: null
        };

        const bookingResponse = await fetch('https://arena.matchday-backend.com/arena/create-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${matchdayToken}`, 'Origin': 'https://arena.matchday.co.th' },
            body: JSON.stringify(bookingPayload)
        });

        if (!bookingResponse.ok) {
            const err = await bookingResponse.text();
            if (bookingResponse.status === 409 || err.includes('conflict')) return new Response(JSON.stringify({ error: 'สนามไม่ว่างแล้ว' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            throw new Error(`Matchday error: ${err}`);
        }

        const bookingData = await bookingResponse.json();
        const createdMatch = bookingData.match || (bookingData.matches && bookingData.matches[0]);

        if (createdMatch && createdMatch.id) {

            // --- INSERT LOCAL DB (Line Source) ---
            console.log(`[Local Sync] Inserting match ${createdMatch.id} as source='line'`);
            await supabase.from('bookings').insert({
                booking_id: String(createdMatch.id),
                user_id: promo.user_id, // Link to Line User ID
                status: 'confirmed',
                date: promo.booking_date,
                time_from: timeFromHHMM,
                time_to: timeToHHMM,
                duration_h: promo.duration_h,
                price_total_thb: promo.final_price,
                source: 'line',
                is_promo: true,
                updated_at: new Date().toISOString()
            });

            // Auto-Correct Price
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatePayload = {
                time_start: `${promo.booking_date} ${timeFromHHMM}:00`,
                time_end: `${promo.booking_date} ${timeToHHMM}:00`,
                description: `${customerName} ${phoneNumber}`,
                change_price: promo.final_price,
                price: promo.final_price
            };
            await fetch(`https://arena.matchday-backend.com/arena/match/${createdMatch.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${matchdayToken}`, 'Origin': 'https://arena.matchday.co.th' },
                body: JSON.stringify(updatePayload)
            });
        }

        // Mark promo used
        await supabase.from('promo_codes').update({ status: 'used', used_at: new Date().toISOString(), booking_id: String(createdMatch?.id) }).eq('id', promo.id);

        // Notify
        const notification = await sendBookingNotification(promo.user_id, promo, customerName, phoneNumber);

        return new Response(JSON.stringify({ success: true, booking: bookingData, promoCode: promo, notification }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error('Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
