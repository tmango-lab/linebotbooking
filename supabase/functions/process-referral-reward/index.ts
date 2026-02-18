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

        // 1. Find referral record for this booking
        const { data: referral, error: refError } = await supabase
            .from('referrals')
            .select('*, referral_programs(*)')
            .eq('booking_id', bookingId)
            .eq('status', 'PENDING_PAYMENT')
            .maybeSingle();

        if (refError) {
            console.error('Referral lookup error:', refError);
            throw new Error('Failed to look up referral');
        }

        if (!referral) {
            console.log(`[Process Referral Reward] No pending referral for booking ${bookingId}`);
            return new Response(
                JSON.stringify({ success: true, message: 'No referral to process' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const referrerId = referral.referrer_id;
        const rewardAmount = referral.reward_amount || 100;
        const programName = referral.referral_programs?.name || 'Referral Reward';

        console.log(`[Process Referral Reward] Rewarding ${referrerId} with ${rewardAmount} THB`);

        // 2. Find or create the referral reward campaign
        // We look for a campaign specifically tagged for referral rewards
        let { data: rewardCampaign } = await supabase
            .from('campaigns')
            .select('id, name')
            .eq('name', '🎁 รางวัลแนะนำเพื่อน')
            .eq('status', 'active')
            .maybeSingle();

        if (!rewardCampaign) {
            // Auto-create the reward campaign if it doesn't exist
            const { data: newCamp, error: campError } = await supabase
                .from('campaigns')
                .insert({
                    name: '🎁 รางวัลแนะนำเพื่อน',
                    description: 'คูปองเงินสดจากการแนะนำเพื่อนมาจองสนาม',
                    status: 'active',
                    discount_amount: rewardAmount,
                    discount_percent: 0,
                    coupon_type: 'MAIN',
                    start_date: new Date().toISOString(),
                    end_date: '2026-05-31T23:59:59+07:00',
                })
                .select()
                .single();

            if (campError) {
                console.error('Failed to create reward campaign:', campError);
                throw new Error('Failed to create reward campaign');
            }
            rewardCampaign = newCamp;
            console.log(`[Process Referral Reward] Created reward campaign: ${rewardCampaign.id}`);
        }

        // 3. Create reward coupon for the referrer
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 3); // Valid for 3 months

        const { error: couponError } = await supabase
            .from('user_coupons')
            .insert({
                user_id: referrerId,
                campaign_id: rewardCampaign.id,
                status: 'ACTIVE',
                collected_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString()
            });

        if (couponError) {
            console.error('Failed to create reward coupon:', couponError);
            throw new Error('Failed to create reward coupon');
        }

        // 4. Update referral status to COMPLETED
        const { error: updateRefError } = await supabase
            .from('referrals')
            .update({
                status: 'COMPLETED',
                updated_at: new Date().toISOString()
            })
            .eq('id', referral.id);

        if (updateRefError) {
            console.error('Failed to update referral status:', updateRefError);
        }

        // 5. Update affiliate stats
        const { error: statsError } = await supabase
            .from('affiliates')
            .update({
                total_referrals: (await supabase
                    .from('referrals')
                    .select('id', { count: 'exact' })
                    .eq('referrer_id', referrerId)
                    .eq('status', 'COMPLETED')).count || 0,
                total_earnings: (await supabase
                    .from('referrals')
                    .select('reward_amount')
                    .eq('referrer_id', referrerId)
                    .eq('status', 'COMPLETED')).data?.reduce((sum: number, r: any) => sum + (r.reward_amount || 0), 0) || 0,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', referrerId);

        if (statsError) {
            console.error('Failed to update affiliate stats:', statsError);
        }

        // 6. Send LINE notification to referrer
        try {
            const { pushMessage } = await import('../_shared/lineClient.ts');

            // Get referee name for the notification
            const { data: referee } = await supabase
                .from('profiles')
                .select('team_name')
                .eq('user_id', referral.referee_id)
                .maybeSingle();

            // Get current total coupons count
            const { count: totalCoupons } = await supabase
                .from('user_coupons')
                .select('id', { count: 'exact' })
                .eq('user_id', referrerId)
                .eq('status', 'ACTIVE')
                .eq('campaign_id', rewardCampaign.id);

            const refereeName = referee?.team_name || 'เพื่อนของคุณ';
            const message = {
                type: 'text' as const,
                text: `🎉 ยินดีด้วย!\n\n${refereeName} จองสนามและชำระเงินสำเร็จแล้ว ⚽️\n\nเราได้ส่งคูปอง ${rewardAmount} บาท เข้ากระเป๋าตังค์คุณแล้ว!\n\n📦 คูปองแนะนำเพื่อนที่ยังไม่ได้ใช้: ${totalCoupons || 1} ใบ\n\nขอบคุณที่ช่วยชวนเพื่อนมาเตะบอลนะครับ! 🙏`
            };

            await pushMessage(referrerId, message);
            console.log(`[Process Referral Reward] LINE notification sent to ${referrerId}`);
        } catch (lineErr) {
            console.error('[Process Referral Reward] LINE notification error (non-blocking):', lineErr);
        }

        console.log(`[Process Referral Reward] Success! Referrer ${referrerId} rewarded ${rewardAmount} THB`);

        return new Response(
            JSON.stringify({
                success: true,
                referrerId,
                rewardAmount,
                message: `Reward ${rewardAmount} THB sent to referrer`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('[Process Referral Reward Error]', err);
        return new Response(
            JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
