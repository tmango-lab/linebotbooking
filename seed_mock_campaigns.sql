-- Refined Seed Mock Campaigns (Thai Version with Conditions)
-- ลบข้อมูลเดิมก่อนเพื่อไม่ให้ซ้ำซ้อน
DELETE FROM campaigns WHERE name IN (
    'ส่วนลดต้อนรับสมาชิกใหม่', 
    'โปรโมชั่นเตะวันธรรมดา สุดคุ้ม', 
    'สิทธิพิเศษสำหรับสมาชิก VIP', 
    'คูปองเสริม: รับน้ำดื่มฟรี 1 แพ็ค', 
    'รอบดึกลดเพิ่ม: Flash Sale สายดึก',
    'รอบดึกลดเพิ่ม: Flash Sale คืนวันหยุด',
    'คูปองลับ: ลดเพิ่มพิเศษสำหรับเมมเบอร์'
);

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
    payment_methods,
    min_spend, 
    total_quantity, 
    limit_per_user, 
    redemption_limit,
    secret_codes, 
    status
) VALUES 
-- 1. ส่วนลดต้อนรับสมาชิกใหม่ (Main, Public)
-- เงื่อนไข: ยอดขั้นต่ำ 500, เฉพาะชำระผ่าน QR เท่านั้น
(
    'ส่วนลดต้อนรับสมาชิกใหม่', 
    'ยินดีต้อนรับเข้าสู่สนาม! รับส่วนลด 100 บาท (ยอดขั้นต่ำ 500.- และชำระผ่าน QR ล่วงหน้าเท่านั้น)', 
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000', 
    100, 0, NULL, 
    FALSE, 'main', TRUE, 
    '2026-02-01T00:00:00Z', '2026-12-31T23:59:59Z', 
    NULL, NULL, 
    NULL, NULL, ARRAY['QR'],
    500, 
    1000, 1, 
    NULL,
    NULL, 'active'
),
-- 2. โปรโมชั่นเตะวันธรรมดา สุดคุ้ม (Main, Public)
-- เงื่อนไข: วันจันทร์-ศุกร์, เฉพาะสนาม 1, 2, 3 เท่านั้น
(
    'โปรโมชั่นเตะวันธรรมดา สุดคุ้ม', 
    'เตะบอลวันธรรมดาลดทันที 20% เฉพาะสนามในร่ม 1-3 (วันจันทร์ - ศุกร์)', 
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1000', 
    0, 20, NULL, 
    FALSE, 'main', TRUE, 
    '2026-02-01T00:00:00Z', '2026-06-30T23:59:59Z', 
    NULL, NULL, 
    ARRAY[1, 2, 3], ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], NULL,
    0, 
    500, 5, 
    NULL,
    NULL, 'active'
),
-- 3. สิทธิพิเศษสำหรับสมาชิก VIP (Main, Secret)
-- เงื่อนไข: เฉพาะสนามใหญ่ 4, 5, 6 และยอดขั้นต่ำ 1,000
(
    'สิทธิพิเศษสำหรับสมาชิก VIP', 
    'สิทธิพิเศษ VIP ลด 150 บาท สำหรับสนาม 7-11 คน (สนาม 4-6) ยอดจอง 1,000.- ขึ้นไป', 
    'https://images.unsplash.com/photo-1624891183219-246d887bcbb2?q=80&w=1000', 
    150, 0, NULL, 
    FALSE, 'main', FALSE, 
    '2026-02-01T00:00:00Z', '2026-12-31T23:59:59Z', 
    NULL, NULL, 
    ARRAY[4, 5, 6], NULL, NULL,
    1000, 
    100, 1, 
    NULL,
    ARRAY['VIP2026'], 'active'
),
-- 4. คูปองเสริม: รับน้ำดื่มฟรี 1 แพ็ค (On-top, Public)
-- เงื่อนไข: ใช้ได้ทุกที่ ทุกเวลา ทุกช่องทางชำระเงิน
(
    'คูปองเสริม: รับน้ำดื่มฟรี 1 แพ็ค', 
    'สะสมแคมเปญนี้เพื่อรับน้ำดื่มฟรี 1 แพ็ค เมื่อมาใช้บริการ (ใช้ร่วมกับโปรโมชั่นหลักอื่นๆ ได้ทุกรายการ)', 
    'https://images.unsplash.com/photo-1560010065-ef560d9d4076?q=80&w=1000', 
    0, 0, 'น้ำดื่ม 1 แพ็ค', 
    TRUE, 'ontop', TRUE, 
    '2026-02-01T00:00:00Z', '2026-12-31T23:59:59Z', 
    NULL, NULL, 
    NULL, NULL, NULL,
    0, 
    2000, 1, 
    NULL,
    NULL, 'active'
),
-- 5. รอบดึกลดเพิ่ม: Flash Sale คืนวันหยุด (On-top, Public)
-- เงื่อนไข: เฉพาะคืนวันเสาร์-อาทิตย์ เวลา 20:00 เป็นต้นไป, ยอดขั้นต่ำ 800
(
    'รอบดึกลดเพิ่ม: Flash Sale คืนวันหยุด', 
    'ลดเพิ่ม 50 บาท สำหรับรอบ 20:00 เป็นต้นไป เฉพาะคืนวันเสาร์และอาทิตย์เท่านั้น', 
    'https://images.unsplash.com/photo-1546519156-d81a3ae6c4cc?q=80&w=1000', 
    50, 0, NULL, 
    TRUE, 'ontop', TRUE, 
    '2026-02-01T00:00:00Z', '2026-06-30T23:59:59Z', 
    '20:00:00', '23:59:59', 
    NULL, ARRAY['Sat', 'Sun'], NULL,
    800, 
    300, 10, 
    NULL,
    NULL, 'active'
),
-- 6. คูปองลับ: ลดเพิ่มพิเศษวันพุธ (On-top, Secret)
-- เงื่อนไข: เฉพาะวันพุธเท่านั้น ยอดขั้นต่ำ 300
(
    'คูปองลับ: ลดเพิ่มพิเศษวันพุธ', 
    'คูปองลับลดเพิ่ม 5% เฉพาะการจองในวันพุธเท่านั้น! (ยอดขั้นต่ำ 300.-)', 
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1000', 
    0, 5, NULL, 
    TRUE, 'ontop', FALSE, 
    '2026-02-01T00:00:00Z', '2026-12-31T23:59:59Z', 
    NULL, NULL, 
    NULL, ARRAY['Wed'], NULL,
    300, 
    500, 1, 
    NULL,
    ARRAY['EXTRA5'], 'active'
);
