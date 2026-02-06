-- Function to check if a campaign has reached its redemption limit
CREATE OR REPLACE FUNCTION check_campaign_limit(p_campaign_id UUID, p_limit INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_count INT;
BEGIN
    -- If no limit is set, strictly speaking the logic calling this should handle it,
    -- but if passed here, unlimited is always true.
    IF p_limit IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Get current count
    SELECT redemption_count INTO current_count
    FROM campaigns
    WHERE id = p_campaign_id;

    -- If campaign not found, assume false (safe fail) or handle err? 
    -- Returning false blocks usage.
    IF current_count IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check
    RETURN current_count < p_limit;
END;
$$;
