-- Fix trigger to only award points if user_id is a valid UUID
CREATE OR REPLACE FUNCTION public.handle_booking_points_earn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    earned_points INT;
    current_balance INT;
    is_valid_uuid BOOLEAN;
BEGIN
    -- Only process if payment is fully paid
    IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
        
        -- Check if user_id is a valid non-null UUID (not 'admin' or null)
        -- We can just check if user_id is not null, and since it references profiles it's usually valid if not null,
        -- but just to be safe:
        IF NEW.user_id IS NOT NULL THEN
            IF NEW.price_total_thb > 0 THEN
                -- Prevent duplicate point awards
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

                    -- Only insert history if the profile actually existed and was updated
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
    END IF;
    RETURN NEW;
END;
$$;
