-- Fix: Allow re-join if previous attempt was pending_payment (payment failed/cancelled)
-- This replaces the try_join_match function to handle stale pending records

CREATE OR REPLACE FUNCTION public.try_join_match(
    p_match_id UUID,
    p_user_id TEXT,
    p_deposit INT,
    p_stripe_pi TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_existing RECORD;
    v_joiner_id UUID;
BEGIN
    -- Lock the row to prevent concurrent joins
    SELECT * INTO v_match
    FROM public.open_matches
    WHERE id = p_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match not found');
    END IF;

    IF v_match.status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match is no longer open');
    END IF;

    IF v_match.slots_filled >= v_match.slots_total THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match is full');
    END IF;

    -- Check if user already joined
    SELECT * INTO v_existing
    FROM public.match_joiners
    WHERE match_id = p_match_id AND user_id = p_user_id;

    IF FOUND THEN
        IF v_existing.status = 'confirmed' THEN
            -- Already paid and confirmed — block
            RETURN jsonb_build_object('success', false, 'error', 'คุณเข้าร่วมห้องนี้แล้ว');
        ELSE
            -- pending_payment or failed — delete old record and allow retry
            DELETE FROM public.match_joiners WHERE id = v_existing.id;
        END IF;
    END IF;

    -- Insert joiner record
    INSERT INTO public.match_joiners (match_id, user_id, status, deposit_paid, stripe_payment_intent_id, joiner_consent_at)
    VALUES (p_match_id, p_user_id, 'pending_payment', p_deposit, p_stripe_pi, NOW())
    RETURNING id INTO v_joiner_id;

    RETURN jsonb_build_object('success', true, 'joiner_id', v_joiner_id);
END;
$$;

-- Clean up any stale pending_payment records from failed attempts
DELETE FROM public.match_joiners WHERE status = 'pending_payment';
