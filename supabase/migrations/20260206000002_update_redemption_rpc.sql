-- Update increment_campaign_redemption to be atomic and check limits
-- Also fix the ID type to BIGINT

CREATE OR REPLACE FUNCTION increment_campaign_redemption(target_campaign_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_count INT;
    max_limit INT;
BEGIN
    -- Select with Row-Level Lock
    SELECT redemption_count, redemption_limit INTO current_count, max_limit
    FROM campaigns
    WHERE id = target_campaign_id
    FOR UPDATE;

    -- Check if limit is reached
    IF max_limit IS NOT NULL AND current_count >= max_limit THEN
        RETURN FALSE;
    END IF;

    -- Increment
    UPDATE campaigns
    SET redemption_count = redemption_count + 1
    WHERE id = target_campaign_id;

    RETURN TRUE;
END;
$$;
