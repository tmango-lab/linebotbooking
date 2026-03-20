
-- Fix increment_campaign_redemption to use UUID and add decrement_campaign_redemption
-- Note: Re-creating with UUID parameter to match campaigns.id type

DROP FUNCTION IF EXISTS increment_campaign_redemption(bigint);
DROP FUNCTION IF EXISTS increment_campaign_redemption(uuid);

CREATE OR REPLACE FUNCTION increment_campaign_redemption(target_campaign_id UUID)
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
    IF max_limit IS NOT NULL AND max_limit > 0 AND current_count >= max_limit THEN
        RETURN FALSE;
    END IF;

    -- Increment
    UPDATE campaigns
    SET redemption_count = COALESCE(redemption_count, 0) + 1
    WHERE id = target_campaign_id;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_campaign_redemption(target_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE campaigns
    SET redemption_count = GREATEST(0, COALESCE(redemption_count, 0) - 1)
    WHERE id = target_campaign_id;
    
    RETURN TRUE;
END;
$$;
