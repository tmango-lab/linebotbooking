import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Process Referral Reward
 * Called when a booking payment is confirmed (by admin or Stripe webhook).
 * Checks if the booking has a referral record in PENDING_PAYMENT status,
 * and if so, creates a reward coupon for the referrer.
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { bookingId } = await req.json();

        console.log(`[Process Referral Reward] bookingId: ${bookingId}`);

        if (!bookingId) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing bookingId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Call SQL Function
        console.log(`[Process Referral Reward] Calling RPC process_referral_reward_sql for ${bookingId}`);

        const { data, error } = await supabase.rpc('process_referral_reward_sql', {
            p_booking_id: bookingId
        });

        if (error) {
            console.error('[Process Referral Reward] RPC Error:', error);
            throw error;
        }

        console.log('[Process Referral Reward] RPC Result:', data);

        // Optional: Send LINE notification if successful
        try {
            if (data && data.success) {
                const { pushMessage } = await import('../_shared/lineClient.ts');

                // Get referee name for the notification
                const { data: referral } = await supabase
                    .from('referrals')
                    .select('*, referee:profiles!referee_id(team_name)')
                    .eq('booking_id', bookingId)
                    .maybeSingle();

                const refereeName = referral?.referee?.team_name || 'เพื่อนของคุณ';
                const rewardAmount = data.reward_amount || 100;

                // Get current total coupons count
                const { count: totalCoupons } = await supabase
                    .from('user_coupons')
                    .select('id', { count: 'exact' })
                    .eq('user_id', data.referrer_id)
                    .eq('status', 'ACTIVE')
                    .eq('campaign_id', 'b9479905-ae44-43b0-8a67-aed95c9c5327'); // Hardcode or query? Better query.

                // Re-query campaign ID just to be safe or use the one from RPC if returned? 
                // RPC returns referrer_id and reward_amount. 

                const message = {
                    type: 'text' as const,
                    text: `🎉 ยินดีด้วย!\n\n${refereeName} จองสนามและชำระเงินสำเร็จแล้ว ⚽️\n\nเราได้ส่งคูปอง ${rewardAmount} บาท เข้ากระเป๋าตังค์คุณแล้ว!\n\nขอบคุณที่ช่วยชวนเพื่อนมาเตะบอลนะครับ! 🙏`
                };

                await pushMessage(data.referrer_id, message);
                console.log(`[Process Referral Reward] LINE notification sent to ${data.referrer_id}`);
            }
        } catch (e) {
            console.error('LINE Error', e);
        }

        return new Response(
            JSON.stringify({
                success: true,
                data
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[Process Referral Reward Error]', err);
        return new Response(
            JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
