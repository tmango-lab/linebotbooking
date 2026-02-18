import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 2. Setup Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 3. Parse Input
        const { referralCode } = await req.json();

        console.log(`[Validate Referral] code: ${referralCode}`);

        if (!referralCode) {
            return new Response(
                JSON.stringify({ valid: false, error: 'กรุณาใส่รหัสแนะนำ' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 4. Find Affiliate with this code
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('user_id, referral_code, status')
            .eq('referral_code', referralCode)
            .maybeSingle();

        if (affiliateError) {
            console.error('Affiliate lookup error:', affiliateError);
            throw new Error('เกิดข้อผิดพลาดในการตรวจสอบรหัส');
        }

        if (!affiliate) {
            return new Response(
                JSON.stringify({ valid: false, error: 'ไม่พบรหัสแนะนำนี้ในระบบ' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (affiliate.status !== 'APPROVED') {
            return new Response(
                JSON.stringify({ valid: false, error: 'รหัสแนะนำนี้ยังไม่ได้รับการอนุมัติ' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 5. Check active referral program
        const { data: activeProgram } = await supabase
            .from('referral_programs')
            .select('id, name, discount_percent, reward_amount, end_date')
            .eq('is_active', true)
            .maybeSingle();

        if (!activeProgram) {
            return new Response(
                JSON.stringify({ valid: false, error: 'ไม่มีโปรแกรมแนะนำเพื่อนที่เปิดใช้งานในขณะนี้' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 6. Check expiry
        if (activeProgram.end_date && new Date(activeProgram.end_date) < new Date()) {
            return new Response(
                JSON.stringify({ valid: false, error: 'โปรแกรมแนะนำเพื่อนนี้หมดอายุแล้ว' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 7. Get referrer's info for display
        const { data: referrerProfile } = await supabase
            .from('profiles')
            .select('team_name')
            .eq('user_id', affiliate.user_id)
            .maybeSingle();

        console.log(`[Validate Referral] Valid! Referrer: ${referrerProfile?.team_name}`);

        return new Response(
            JSON.stringify({
                valid: true,
                referrer: {
                    teamName: referrerProfile?.team_name || 'เพื่อน',
                    userId: affiliate.user_id
                },
                program: {
                    id: activeProgram.id,
                    name: activeProgram.name,
                    discountPercent: activeProgram.discount_percent,
                    rewardAmount: activeProgram.reward_amount
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('[Validate Referral Error]', err);
        return new Response(
            JSON.stringify({ valid: false, error: err.message || 'Internal Server Error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
