-- Fix campaign deletion by allowing CASCADE delete for user_coupons
-- This ensures that when a campaign is deleted, all issued coupons are also deleted.

ALTER TABLE user_coupons
DROP CONSTRAINT IF EXISTS user_coupons_campaign_id_fkey;

ALTER TABLE user_coupons
ADD CONSTRAINT user_coupons_campaign_id_fkey 
  FOREIGN KEY (campaign_id) 
  REFERENCES campaigns(id) 
  ON DELETE CASCADE;

-- Also add policy for DELETE if missing (just to be safe, though fix_campaigns_rls.sql should have it)
DROP POLICY IF EXISTS "Allow authenticated delete" ON campaigns;
CREATE POLICY "Allow authenticated delete" ON campaigns
    FOR DELETE
    USING (true);
