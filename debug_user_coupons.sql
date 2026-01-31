-- Check ALL user_coupons for this campaign (regardless of status)
SELECT 
  uc.id,
  uc.user_id,
  uc.status,
  uc.created_at,
  c.name as campaign_name
FROM user_coupons uc
JOIN campaigns c ON uc.campaign_id = c.id
WHERE c.id = 'b75c3e67-f9a1-451a-8498-e578c8540d10'
ORDER BY uc.created_at DESC;

-- Also check what userId the webhook is sending
-- You can see this in the collect-coupon logs
