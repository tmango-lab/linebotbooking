-- Fix existing coupons by adding expires_at
-- This will update all NULL expires_at coupons for the user

UPDATE user_coupons
SET expires_at = (
    SELECT COALESCE(
        CASE 
            WHEN c.duration_days IS NOT NULL 
            THEN user_coupons.created_at + (c.duration_days || ' days')::INTERVAL
            ELSE c.end_date
        END,
        NOW() + INTERVAL '30 days'
    )
    FROM campaigns c
    WHERE c.id = user_coupons.campaign_id
)
WHERE user_id = 'Ua636ab14081b483636896549d2026398'
  AND expires_at IS NULL 
  AND status = 'ACTIVE';

-- Verify the fix
SELECT 
  uc.id,
  uc.status,
  uc.expires_at,
  uc.created_at,
  c.name as campaign_name,
  CASE 
    WHEN uc.expires_at IS NULL THEN '❌ NULL'
    WHEN uc.expires_at > NOW() THEN '✅ Valid'
    ELSE '⚠️ Expired'
  END as expiry_check
FROM user_coupons uc
JOIN campaigns c ON uc.campaign_id = c.id
WHERE uc.user_id = 'Ua636ab14081b483636896549d2026398'
ORDER BY uc.created_at DESC;
