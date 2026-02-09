-- Seed Mock Campaigns (Thai Version)
-- This script creates 6 diverse campaigns to showcase the UI in the admin and wallet pages.

INSERT INTO campaigns (
    name, 
    description, 
    image_url, 
    discount_amount, 
    discount_percent, 
    reward_item, 
    is_stackable, 
    coupon_type, 
    is_public, 
    start_date, 
    end_date, 
    valid_time_start, 
    valid_time_end, 
    eligible_fields, 
    eligible_days, 
    min_spend, 
    total_quantity, 
    limit_per_user, 
    redemption_limit,
    secret_codes, 
    status
) VALUES 
-- 1. ส่วนลดต้อนรับสมาชิกใหม่ (Main, Public)
(
    'ส่วนลดต้อนรับสมาชิกใหม่', 
    'ยินดีต้อนรับเข้าสู่สนาม! รับส่วนลดทันที 100 บาท สำหรับการจองครั้งแรกของคุณ', 
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000', 
    100, 0, NULL, 
    FALSE, 'main', TRUE, 
    '2026-02-01T00:00:00Z', '2026-12-31T23:59:59Z', 
    NULL, NULL, 
    NULL, NULL, 
    0, 
    1000, 1, 
    NULL,
    NULL, 'active'
),
-- 2. โปรโมชั่นเตะวันธรรมดา สุดคุ้ม (Main, Public)
(
    'โปรโมชั่นเตะวันธรรมดา สุดคุ้ม', 
    'เตะบอลวันธรรมดาลดทันที 20% (จันทร์ - ศุกร์) เหมาะสำหรับสายออกกำลังกายหลังเลิกงาน', 
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1000', 
    0, 20, NULL, 
    FALSE, 'main', TRUE, 
    '2026-02-01T00:00:00Z', '2026-06-30T23:59:59Z', 
    NULL, NULL, 
    NULL, ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 
    0, 
    500, 5, 
    NULL,
    NULL, 'active'
),
-- 3. สิทธิพิเศษสำหรับสมาชิก VIP (Main, Secret)
(
    'สิทธิพิเศษสำหรับสมาชิก VIP', 
    'สิทธิพิเศษเฉพาะสมาชิก VIP เท่านั้น ลดเพิ่ม 150 บาท สำหรับทุกการจอง', 
    'https://images.unsplash.com/photo-1624891183219-246d887bcbb2?q=80&w=1000', 
    150, 0, NULL, 
    FALSE, 'main', FALSE, 
    '2026-02-01T00:00:00Z', '2026-12-31T23:59:59Z', 
    NULL, NULL, 
    NULL, NULL, 
    0, 
    100, 1, 
    NULL,
    ARRAY['VIP2026'], 'active'
),
-- 4. คูปองเสริม: รับน้ำดื่มฟรี 1 แพ็ค (On-top, Public)
(
    'คูปองเสริม: รับน้ำดื่มฟรี 1 แพ็ค', 
    'สะสมแคมเปญนี้เพื่อรับน้ำดื่มฟรี 1 แพ็ค เมื่อมาใช้บริการ (สามารถใช้ร่วมกับคูปองส่วนลดอื่นๆ ได้)', 
    'https://images.unsplash.com/photo-1560010065-ef560d9d4076?q=80&w=1000', 
    0, 0, 'น้ำดื่ม 1 แพ็ค', 
    TRUE, 'ontop', TRUE, 
    '2026-02-01T00:00:00Z', '2026-12-31T23:59:59Z', 
    NULL, NULL, 
    NULL, NULL, 
    0, 
    2000, 1, 
    NULL,
    NULL, 'active'
),
-- 5. รอบดึกลดเพิ่ม: Flash Sale สายดึก (On-top, Public)
(
    'รอบดึกลดเพิ่ม: Flash Sale สายดึก', 
    'ลดเพิ่ม 50 บาท ทันที เมื่อจองรอบเวลา 21:00 เป็นต้นไป (ยอดขั้นต่ำ 800 บาท)', 
    'https://images.unsplash.com/photo-1546519156-d81a3ae6c4cc?q=80&w=1000', 
    50, 0, NULL, 
    TRUE, 'ontop', TRUE, 
    '2026-02-01T00:00:00Z', '2026-06-30T23:59:59Z', 
    '21:00:00', '23:59:59', 
    NULL, NULL, 
    800, 
    300, 10, 
    NULL,
    NULL, 'active'
),
-- 6. คูปองลับ: ลดเพิ่มพิเศษสำหรับเมมเบอร์ (On-top, Secret)
(
    'คูปองลับ: ลดเพิ่มพิเศษสำหรับเมมเบอร์', 
    'คูปองลับลดเพิ่ม 5% สำหรับเมมเบอร์ที่ได้รับรหัสพิเศษจากไลน์ OA เท่านั้น', 
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1000', 
    0, 5, NULL, 
    TRUE, 'ontop', FALSE, 
    '2026-02-01T00:00:00Z', '2026-12-31T23:59:59Z', 
    NULL, NULL, 
    NULL, NULL, 
    0, 
    500, 1, 
    NULL,
    ARRAY['EXTRA5'], 'active'
);
