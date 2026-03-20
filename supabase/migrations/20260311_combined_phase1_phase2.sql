-- ============================================
-- Combined Migration: Phase 1 + Phase 2
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PHASE 1: Dynamic Point Calculation
-- ============================================

-- 1. Add point earning ratio columns to system_settings
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS point_earn_condition_thb integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS point_earn_reward integer DEFAULT 10;

COMMENT ON COLUMN public.system_settings.point_earn_condition_thb IS 'ทุกๆ X บาท (เงื่อนไขการได้รับแต้ม)';
COMMENT ON COLUMN public.system_settings.point_earn_reward IS 'ได้รับ Y แต้ม (จำนวนแต้มที่ได้)';

UPDATE public.system_settings
SET point_earn_condition_thb = 100, point_earn_reward = 10
WHERE id = 1 AND point_earn_condition_thb IS NULL;

-- 2. Update handle_booking_points_earn trigger
CREATE OR REPLACE FUNCTION public.handle_booking_points_earn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    earned_points INT;
    current_balance INT;
    v_condition INT;
    v_reward INT;
BEGIN
    IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
        IF NEW.price_total_thb > 0 THEN
            IF EXISTS (
                SELECT 1 FROM public.point_history 
                WHERE reference_type = 'booking' AND reference_id = NEW.id::text
            ) THEN
                RETURN NEW;
            END IF;

            SELECT 
                COALESCE(point_earn_condition_thb, 100),
                COALESCE(point_earn_reward, 10)
            INTO v_condition, v_reward
            FROM public.system_settings
            WHERE id = 1;

            IF v_condition IS NULL OR v_condition <= 0 THEN v_condition := 100; END IF;
            IF v_reward IS NULL OR v_reward <= 0 THEN v_reward := 10; END IF;

            earned_points := FLOOR(NEW.price_total_thb / v_condition) * v_reward;

            IF earned_points > 0 THEN
                UPDATE public.profiles
                SET points = points + earned_points
                WHERE user_id = NEW.user_id
                RETURNING points INTO current_balance;

                INSERT INTO public.point_history (
                    user_id, amount, balance_after, transaction_type, description, reference_type, reference_id
                ) VALUES (
                    NEW.user_id, earned_points, current_balance, 'EARN_BOOKING', 
                    'ได้รับแต้มจากการจองสนาม #' || NEW.id, 'booking', NEW.id::text
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================
-- PHASE 2: External Merchant Redemption
-- ============================================

-- 3. Create merchants table
CREATE TABLE IF NOT EXISTS public.merchants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    pin_code text NOT NULL,
    contact_name text,
    contact_phone text,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT merchants_status_check CHECK (status IN ('active', 'inactive'))
);

ALTER TABLE public.merchants OWNER TO postgres;
COMMENT ON TABLE public.merchants IS 'ร้านค้าพาร์ทเนอร์ภายนอกสำหรับระบบแลกของรางวัล';

-- 4. Add merchant_id to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.campaigns.merchant_id IS 'ถ้ามีค่า = คูปองร้านค้าพาร์ทเนอร์, ถ้า NULL = คูปองส่วนลดสนาม';

-- 5. Add redemption_token to user_coupons
ALTER TABLE public.user_coupons
  ADD COLUMN IF NOT EXISTS redemption_token text,
  ADD COLUMN IF NOT EXISTS redemption_token_expires_at timestamptz;

-- 6. RLS for merchants
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access on merchants') THEN
        CREATE POLICY "Admin full access on merchants" ON public.merchants FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- 7. Grants & Indexes
GRANT ALL ON TABLE public.merchants TO postgres;
GRANT ALL ON TABLE public.merchants TO authenticated;
GRANT SELECT ON TABLE public.merchants TO anon;
GRANT ALL ON TABLE public.merchants TO service_role;

CREATE INDEX IF NOT EXISTS idx_merchants_pin_code ON public.merchants(pin_code);
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant_id ON public.campaigns(merchant_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_redemption_token ON public.user_coupons(redemption_token);

-- 8. RPC: increment_campaign_redemption_count
CREATE OR REPLACE FUNCTION public.increment_campaign_redemption_count(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.campaigns
    SET redemption_count = COALESCE(redemption_count, 0) + 1
    WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_campaign_redemption_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_campaign_redemption_count(uuid) TO postgres;
