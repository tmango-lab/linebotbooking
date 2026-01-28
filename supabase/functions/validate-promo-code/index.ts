// @ts-nocheck
// supabase/functions/validate-promo-code/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { code } = await req.json();

        if (!code || typeof code !== 'string') {
            return new Response(
                JSON.stringify({ error: 'กรุณาระบุโค้ดโปรโมชั่น' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Supabase client with service role to bypass RLS
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Query promo code
        const { data: promoCode, error } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', code)
            .single();

        if (error || !promoCode) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    reason: 'ไม่พบโค้ดนี้ในระบบ'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check status
        if (promoCode.status === 'used') {
            return new Response(
                JSON.stringify({
                    valid: false,
                    reason: 'โค้ดนี้ถูกใช้ไปแล้ว'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (promoCode.status === 'expired') {
            return new Response(
                JSON.stringify({
                    valid: false,
                    reason: 'โค้ดนี้หมดอายุแล้ว'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check expiry
        const now = new Date();
        const expiresAt = new Date(promoCode.expires_at);
        if (now > expiresAt) {
            // Auto-expire
            await supabase
                .from('promo_codes')
                .update({ status: 'expired' })
                .eq('id', promoCode.id);

            return new Response(
                JSON.stringify({
                    valid: false,
                    reason: 'โค้ดนี้หมดอายุแล้ว'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check if slot is still available
        const timeFromHHMM = promoCode.time_from.substring(0, 5);
        const timeToHHMM = promoCode.time_to.substring(0, 5);

        const { data: existingBookings } = await supabase
            .from('bookings')
            .select('*')
            .eq('field_no', promoCode.field_id)
            .eq('date', promoCode.booking_date)
            .neq('status', 'cancelled');

        const hasConflict = (existingBookings || []).some((b: any) => {
            const existingStartStr = b.time_from.substring(0, 5);
            const existingEndStr = b.time_to.substring(0, 5);

            const existingStart = new Date(`${b.date}T${existingStartStr}:00+07:00`);
            const existingEnd = new Date(`${b.date}T${existingEndStr}:00+07:00`);

            const promoStart = new Date(`${promoCode.booking_date}T${timeFromHHMM}:00+07:00`);
            const promoEnd = new Date(`${promoCode.booking_date}T${timeToHHMM}:00+07:00`);

            return promoStart < existingEnd && promoEnd > existingStart;
        });

        if (hasConflict) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    reason: 'สนามไม่ว่างแล้ว (มีผู้จองตัดหน้าเมื่อสักครู่)'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('team_name, phone_number')
            .eq('user_id', promoCode.user_id)
            .single();

        // Valid!
        return new Response(
            JSON.stringify({
                valid: true,
                code: {
                    ...promoCode,
                    profile: profile || null
                }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );


    } catch (err: any) {
        console.error('Error validating promo code:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบโค้ด' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
