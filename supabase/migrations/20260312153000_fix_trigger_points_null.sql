-- Fix Point History Database Constraint Error ("balance_after" violates not-null constraint)
-- This happens when user_id is NULL (e.g., admin booking via phone) 
-- or when the profile doesnt exist, leading to current_balance evaluating as NULL.

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
            
            -- ป้องกันการให้แต้มกับ Admin Booking (user_id IS NULL)
            IF NEW.user_id IS NULL THEN
                RETURN NEW;
            END IF;

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
                -- อัปเดต public.profiles โดยใช้ COALESCE(points, 0) เพื่อป้องกัน null
                UPDATE public.profiles
                SET points = COALESCE(points, 0) + earned_points
                WHERE user_id = NEW.user_id
                RETURNING points INTO current_balance;

                -- ต้องแน่ใจว่าได้อัปเดต point เรียบร้อยแล้วจริงๆ ถึงจะเขียนลง point_history ได้
                IF current_balance IS NOT NULL THEN
                    INSERT INTO public.point_history (
                        user_id, amount, balance_after, transaction_type, description, reference_type, reference_id
                    ) VALUES (
                        NEW.user_id, earned_points, current_balance, 'EARN_BOOKING', 
                        'ได้รับแต้มจากการจองสนาม #' || NEW.id, 'booking', NEW.id::text
                    );
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
