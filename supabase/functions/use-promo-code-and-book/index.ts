// @ts-nocheck
// supabase/functions/use-promo-code-and-book/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { pushMessage } from '../_shared/lineClient.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helpers
function getFieldName(fieldId: number): string {
    const fieldNames: Record<number, string> = {
        1: 'สนาม 1 (5 คน)', 2: 'สนาม 2 (5 คน)', 3: 'สนาม 3 (7-8 คน)',
        4: 'สนาม 4 (7 คน)', 5: 'สนาม 5 (7 คน)', 6: 'สนาม 6 (7 คน)',
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
        const { data: promo, error: promoError } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', promoCode)
            .single();

        if (promoError || !promo) {
            return new Response(JSON.stringify({ error: 'ไม่พบโค้ดนี้ในระบบ' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (promo.status !== 'active') {
            return new Response(JSON.stringify({ error: 'โค้ดนี้ไม่สามารถใช้งานได้แล้ว' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (new Date() > new Date(promo.expires_at)) {
            return new Response(JSON.stringify({ error: 'โค้ดนี้หมดอายุแล้ว' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Step 2: Check slot availability
        const timeFromHHMM = promo.time_from.substring(0, 5);
        const timeToHHMM = promo.time_to.substring(0, 5);

        const { data: existingBookings } = await supabase
            .from('bookings')
            .select('*')
            .eq('field_no', promo.field_id)
            .eq('date', promo.booking_date)
            .neq('status', 'cancelled');

        // Check for time conflicts
        const hasConflict = (existingBookings || []).some((b: any) => {
            // Normalize existing booking times
            const existingStartStr = b.time_from.substring(0, 5);
            const existingEndStr = b.time_to.substring(0, 5);

            const existingStart = new Date(`${b.date}T${existingStartStr}:00+07:00`);
            const existingEnd = new Date(`${b.date}T${existingEndStr}:00+07:00`);

            // Normalize promo times (already substringed above, but ensuring consistency)
            const promoStart = new Date(`${promo.booking_date}T${timeFromHHMM}:00+07:00`);
            const promoEnd = new Date(`${promo.booking_date}T${timeToHHMM}:00+07:00`);

            return promoStart < existingEnd && promoEnd > existingStart;
        });

        if (hasConflict) {
            return new Response(JSON.stringify({ error: 'สนามไม่ว่างแล้ว' }), {
                status: 409,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Step 3: Create booking in Local DB
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
                user_id: promo.user_id,
                booking_id: Date.now().toString(), // Generate numeric ID for compatibility
                field_no: promo.field_id,
                status: 'confirmed',
                date: promo.booking_date,
                time_from: timeFromHHMM,
                time_to: timeToHHMM,
                duration_h: promo.duration_h,
                price_total_thb: promo.final_price,
                display_name: customerName,
                phone_number: phoneNumber,
                admin_note: `Promo: ${promoCode} | Discount: ${promo.discount_amount}`,
                source: 'line',
                is_promo: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (bookingError) {
            console.error('[Booking Error]:', bookingError);
            return new Response(JSON.stringify({ error: 'ไม่สามารถสร้างการจองได้' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Promo Booking] Created: ${booking.booking_id}`);

        // Step 4: Mark promo as used
        await supabase
            .from('promo_codes')
            .update({
                status: 'used',
                used_at: new Date().toISOString(),
                booking_id: booking.booking_id
            })
            .eq('id', promo.id);

        // Step 5: Send notification
        const notification = await sendBookingNotification(promo.user_id, promo, customerName, phoneNumber);

        return new Response(JSON.stringify({
            success: true,
            booking: {
                id: booking.booking_id,
                field_no: booking.field_no,
                date: booking.date,
                time_from: booking.time_from,
                time_to: booking.time_to,
                price: booking.price_total_thb
            },
            promoCode: promo,
            notification
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
