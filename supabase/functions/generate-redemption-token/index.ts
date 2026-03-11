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

    const { couponId, userId } = await req.json();

    if (!couponId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing couponId or userId" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Verify the coupon belongs to this user and is ACTIVE
    const { data: coupon, error: couponError } = await supabase
      .from("user_coupons")
      .select("id, status, user_id, campaign_id")
      .eq("id", couponId)
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .single();

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({ success: false, error: "ไม่พบคูปอง หรือคูปองไม่ได้อยู่ในสถานะใช้งานได้" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate token and expiration (15 minutes)
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Save token using service_role (bypasses RLS)
    const { error: updateError } = await supabase
      .from("user_coupons")
      .update({
        redemption_token: token,
        redemption_token_expires_at: expiresAt,
      })
      .eq("id", couponId);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: "ไม่สามารถสร้าง Token ได้: " + updateError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        expiresAt,
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
