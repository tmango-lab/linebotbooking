CREATE OR REPLACE FUNCTION public.handle_booking_points_earn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    earned_points INT;
    current_balance INT;
BEGIN
    IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
        IF NEW.price_total_thb > 0 THEN
            IF EXISTS (
                SELECT 1 FROM public.point_history 
                WHERE reference_type = 'booking' AND reference_id = NEW.id::text
            ) THEN
                RETURN NEW;
            END IF;

            earned_points := FLOOR(NEW.price_total_thb / 100) * 10;

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
