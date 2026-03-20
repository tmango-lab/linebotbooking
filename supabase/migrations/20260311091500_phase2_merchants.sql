-- Phase 2: External Merchant Redemption
-- สร้างตาราง merchants และเพิ่ม merchant_id ใน campaigns

-- 1. Create merchants table
CREATE TABLE IF NOT EXISTS public.merchants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    pin_code text NOT NULL,
    contact_name text,
    contact_phone text,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT merchants_status_check CHECK (status IN ('active', 'inactive'))
);

ALTER TABLE public.merchants OWNER TO postgres;

COMMENT ON TABLE public.merchants IS 'ร้านค้าพาร์ทเนอร์ภายนอกสำหรับระบบแลกของรางวัล';
COMMENT ON COLUMN public.merchants.pin_code IS 'รหัส PIN สำหรับร้านค้าเข้าใช้ระบบสแกน (4-6 หลัก)';

-- 2. Add merchant_id column to campaigns table
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.campaigns.merchant_id IS 'ถ้ามีค่า = คูปองร้านค้าพาร์ทเนอร์, ถ้า NULL = คูปองส่วนลดสนาม (เดิม)';

-- 3. Add redemption_token fields to user_coupons for QR verification
ALTER TABLE public.user_coupons
  ADD COLUMN IF NOT EXISTS redemption_token text,
  ADD COLUMN IF NOT EXISTS redemption_token_expires_at timestamptz;

COMMENT ON COLUMN public.user_coupons.redemption_token IS 'Token สำหรับยืนยัน QR Code ที่ร้านค้า (หมดอายุใน 15 นาที)';

-- 4. RLS Policies for merchants table
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

-- Allow authenticated (admin) full access
CREATE POLICY "Admin full access on merchants" ON public.merchants
    FOR ALL USING (true) WITH CHECK (true);

-- Allow anon to read active merchants (for PIN login check)
CREATE POLICY "Anon read active merchants" ON public.merchants
    FOR SELECT USING (status = 'active');

-- 5. Grant permissions
GRANT ALL ON TABLE public.merchants TO postgres;
GRANT ALL ON TABLE public.merchants TO authenticated;
GRANT SELECT ON TABLE public.merchants TO anon;
GRANT ALL ON TABLE public.merchants TO service_role;

-- 6. Create index for PIN lookup
CREATE INDEX IF NOT EXISTS idx_merchants_pin_code ON public.merchants(pin_code);
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant_id ON public.campaigns(merchant_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_redemption_token ON public.user_coupons(redemption_token);
