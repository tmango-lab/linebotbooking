-- Debug Script: ตรวจสอบว่าทำไมคูปองไม่แสดงในกระเป๋า
-- รัน query นี้แล้วส่งผลลัพธ์ให้ดูครับ

-- 1. ดูคูปองทั้งหมดของ user (ไม่มี filter)
SELECT 
  uc.id,
  uc.user_id,
  uc.campaign_id,
  uc.status,
  uc.expires_at,
  uc.created_at,
  c.name as campaign_name,
  c.coupon_type,
  c.benefit_type,
  c.benefit_value,
  -- เช็คว่า expires_at ผ่านเงื่อนไขหรือไม่
  CASE 
    WHEN uc.expires_at IS NULL THEN '❌ NULL'
    WHEN uc.expires_at > NOW() THEN '✅ Valid'
    ELSE '⚠️ Expired'
  END as expiry_check
FROM user_coupons uc
JOIN campaigns c ON uc.campaign_id = c.id
WHERE uc.user_id = 'Ua636ab14081b483636896549d2026398'
ORDER BY uc.created_at DESC;

-- 2. เช็คว่า query ของ get-my-coupons จะได้อะไรบ้าง (เหมือนกับที่ API ทำ)
SELECT 
  uc.id,
  uc.status,
  uc.expires_at,
  c.id as campaign_id,
  c.name,
  c.coupon_type,
  c.benefit_type,
  c.benefit_value
FROM user_coupons uc
JOIN campaigns c ON uc.campaign_id = c.id
WHERE uc.user_id = 'Ua636ab14081b483636896549d2026398'
  AND uc.status = 'ACTIVE'
  AND uc.expires_at > NOW()
ORDER BY uc.created_at DESC;

-- 3. เช็คว่ามีคูปองที่ถูก filter ออกไปหรือไม่
SELECT 
  'Filtered by status' as reason,
  COUNT(*) as count
FROM user_coupons
WHERE user_id = 'Ua636ab14081b483636896549d2026398'
  AND status != 'ACTIVE'

UNION ALL

SELECT 
  'Filtered by expires_at NULL' as reason,
  COUNT(*) as count
FROM user_coupons
WHERE user_id = 'Ua636ab14081b483636896549d2026398'
  AND status = 'ACTIVE'
  AND expires_at IS NULL

UNION ALL

SELECT 
  'Filtered by expires_at past' as reason,
  COUNT(*) as count
FROM user_coupons
WHERE user_id = 'Ua636ab14081b483636896549d2026398'
  AND status = 'ACTIVE'
  AND expires_at IS NOT NULL
  AND expires_at <= NOW();
