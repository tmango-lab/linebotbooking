-- Verification Script: Check if coupons have expires_at set
-- Run this after collecting a coupon via LINE Bot

-- 1. Check the most recent coupon collected
SELECT 
  uc.id,
  uc.user_id,
  uc.campaign_id,
  uc.status,
  uc.expires_at,
  uc.created_at,
  c.name as campaign_name,
  c.duration_days,
  c.end_date as campaign_end_date,
  -- Check if expires_at is set correctly
  CASE 
    WHEN uc.expires_at IS NULL THEN '❌ NULL (BUG!)'
    WHEN uc.expires_at > NOW() THEN '✅ Valid (Future)'
    ELSE '⚠️ Expired'
  END as expiry_status
FROM user_coupons uc
JOIN campaigns c ON uc.campaign_id = c.id
WHERE uc.user_id = 'Ua636ab14081b483636896549d2026398'  -- Replace with your LINE User ID
ORDER BY uc.created_at DESC
LIMIT 5;

-- 2. Check if get-my-coupons would return this coupon
SELECT 
  uc.id,
  uc.status,
  uc.expires_at,
  c.name,
  c.coupon_type
FROM user_coupons uc
JOIN campaigns c ON uc.campaign_id = c.id
WHERE uc.user_id = 'Ua636ab14081b483636896549d2026398'
  AND uc.status = 'ACTIVE'
  AND uc.expires_at > NOW()  -- This is the filter that was causing the issue
ORDER BY uc.created_at DESC;

-- 3. Find any broken coupons (NULL expires_at)
SELECT 
  COUNT(*) as broken_coupons_count,
  COUNT(DISTINCT user_id) as affected_users
FROM user_coupons
WHERE expires_at IS NULL AND status = 'ACTIVE';

-- 4. Optional: Fix existing broken coupons
-- Uncomment to run:
/*
UPDATE user_coupons
SET expires_at = (
    SELECT COALESCE(
        CASE 
            WHEN c.duration_days IS NOT NULL 
            THEN uc.created_at + (c.duration_days || ' days')::INTERVAL
            ELSE c.end_date
        END,
        NOW() + INTERVAL '30 days' -- Fallback: 30 days from now
    )
    FROM campaigns c
    WHERE c.id = user_coupons.campaign_id
)
WHERE expires_at IS NULL AND status = 'ACTIVE';
*/
