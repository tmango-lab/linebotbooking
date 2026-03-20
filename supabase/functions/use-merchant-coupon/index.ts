import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { merchantId, redemptionToken, couponId } = await req.json();

    if (!merchantId || !redemptionToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing merchantId or redemptionToken" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Find the coupon by token
    const { data: coupon, error: couponError } = await supabase
      .from("user_coupons")
      .select("id, status, redemption_token, redemption_token_expires_at, campaign_id, campaigns(merchant_id, name, reward_item)")
      .eq("redemption_token", redemptionToken)
      .single();

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({ success: false, error: "ไม่พบคูปองหรือ Token ไม่ถูกต้อง" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verify coupon status is ACTIVE
    if (coupon.status !== "ACTIVE") {
      return new Response(
        JSON.stringify({ success: false, error: "คูปองนี้ถูกใช้ไปแล้ว หรือหมดอายุ" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify token hasn't expired
    if (coupon.redemption_token_expires_at && new Date(coupon.redemption_token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Token หมดอายุแล้ว กรุณาให้ลูกค้าสร้าง QR ใหม่" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verify merchant matches campaign
    const campaignMerchantId = (coupon.campaigns as any)?.merchant_id;
    if (campaignMerchantId !== merchantId) {
      return new Response(
        JSON.stringify({ success: false, error: "คูปองนี้ไม่ได้อยู่ในร้านค้าของคุณ" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Mark coupon as USED
    const { error: updateError } = await supabase
      .from("user_coupons")
      .update({
        status: "USED",
        used_at: new Date().toISOString(),
        redemption_token: null, // Clear the token
        redemption_token_expires_at: null,
      })
      .eq("id", coupon.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: "ไม่สามารถอัปเดตคูปองได้: " + updateError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Increment redemption_count on campaign
    await supabase.rpc("increment_campaign_redemption_count", { p_campaign_id: coupon.campaign_id });

    const rewardItem = (coupon.campaigns as any)?.reward_item || (coupon.campaigns as any)?.name;

    return new Response(
      JSON.stringify({
        success: true,
        message: `สแกนสำเร็จ! "${rewardItem}" ถูกใช้งานแล้ว ✅`,
        couponId: coupon.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
