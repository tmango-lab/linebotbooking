-- Clean up test coupons that were collected during debugging
-- This removes coupons that might have been created with incorrect status values

DELETE FROM user_coupons 
WHERE campaign_id IN (
  SELECT id FROM campaigns WHERE secret_codes @> ARRAY['ป้าขาว']
);

-- Verify cleanup
SELECT 
  uc.id, 
  uc.user_id, 
  uc.status, 
  c.name, 
  c.status as campaign_status
FROM user_coupons uc
JOIN campaigns c ON uc.campaign_id = c.id
WHERE c.secret_codes @> ARRAY['ป้าขาว'];
