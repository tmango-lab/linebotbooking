-- Phase 1: Dynamic Point Calculation
-- เพิ่มฟิลด์ตั้งค่าสัดส่วนคะแนนใน system_settings

-- 1. Add point earning ratio columns to system_settings
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS point_earn_condition_thb integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS point_earn_reward integer DEFAULT 10;

COMMENT ON COLUMN public.system_settings.point_earn_condition_thb IS 'ทุกๆ X บาท (เงื่อนไขการได้รับแต้ม)';
COMMENT ON COLUMN public.system_settings.point_earn_reward IS 'ได้รับ Y แต้ม (จำนวนแต้มที่ได้)';

-- 2. Update existing row to have default values
UPDATE public.system_settings
SET point_earn_condition_thb = 100, point_earn_reward = 10
WHERE id = 1 AND point_earn_condition_thb IS NULL;

-- 3. Update handle_booking_points_earn trigger to use dynamic values
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
            -- ป้องกันการให้แต้มซ้ำ
            IF EXISTS (
                SELECT 1 FROM public.point_history 
                WHERE reference_type = 'booking' AND reference_id = NEW.id::text
            ) THEN
                RETURN NEW;
            END IF;

            -- ดึงค่าสัดส่วนจาก system_settings (ค่า default: ทุก 100 บาท ได้ 10 แต้ม)
            SELECT 
                COALESCE(point_earn_condition_thb, 100),
                COALESCE(point_earn_reward, 10)
            INTO v_condition, v_reward
            FROM public.system_settings
            WHERE id = 1;

            -- fallback ถ้าไม่มีข้อมูลใน system_settings
            IF v_condition IS NULL OR v_condition <= 0 THEN
                v_condition := 100;
            END IF;
            IF v_reward IS NULL OR v_reward <= 0 THEN
                v_reward := 10;
            END IF;

            -- คำนวณแต้มตามสูตรใหม่
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
