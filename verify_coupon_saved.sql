-- ตรวจสอบว่าคูปองถูกบันทึกจริงหรือไม่
SELECT 
  uc.id,
  uc.user_id,
  uc.campaign_id,
  uc.status,
  uc.created_at,
  c.name as campaign_name,
  c.coupon_type
FROM user_coupons uc
JOIN campaigns c ON uc.campaign_id = c.id
WHERE uc.user_id = 'Ua636ab14081b483636896549d2026398'
ORDER BY uc.created_at DESC;
