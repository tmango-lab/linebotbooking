-- Migration: Add Promo Code System
-- Created: 2026-01-21

-- =====================================================
-- Table: promo_codes
-- Stores promotional discount codes for LINE chatbot users
-- =====================================================

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Booking Details
  field_id INTEGER NOT NULL REFERENCES fields(id),
  booking_date DATE NOT NULL,
  time_from TIME NOT NULL,
  time_to TIME NOT NULL,
  duration_h NUMERIC NOT NULL,
  
  -- Pricing
  original_price NUMERIC NOT NULL,
  discount_type VARCHAR(10) NOT NULL, -- 'percent' or 'fixed'
  discount_value NUMERIC NOT NULL,    -- 10 (for 10%) or 50 (for 50 THB)
  discount_amount NUMERIC NOT NULL,   -- Calculated discount in THB
  final_price NUMERIC NOT NULL,       -- Price after discount
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'used', 'expired'
  used_at TIMESTAMPTZ,
  used_by TEXT,                        -- Admin user who redeemed it
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Optional: Link to actual booking if created
  booking_id TEXT,
  notes TEXT,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'used', 'expired')),
  CONSTRAINT valid_discount_type CHECK (discount_type IN ('percent', 'fixed')),
  CONSTRAINT positive_prices CHECK (
    original_price > 0 AND 
    discount_amount >= 0 AND 
    final_price >= 0
  )
);

-- Indexes for performance
CREATE INDEX idx_promo_code ON public.promo_codes(code);
CREATE INDEX idx_promo_user_date ON public.promo_codes(user_id, booking_date);
CREATE INDEX idx_promo_status ON public.promo_codes(status);
CREATE INDEX idx_promo_expires ON public.promo_codes(expires_at);
CREATE INDEX idx_promo_created ON public.promo_codes(created_at DESC);

-- =====================================================
-- Table: promo_settings
-- Global configuration for promo code system
-- =====================================================

CREATE TABLE IF NOT EXISTS public.promo_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  
  -- Discount Configuration
  discount_type VARCHAR(10) DEFAULT 'percent', -- 'percent' or 'fixed'
  discount_value NUMERIC DEFAULT 10,           -- 10 for 10% or 50 for 50 THB
  
  -- Rules
  min_booking_price NUMERIC DEFAULT 500,       -- Minimum price to get code
  expiry_minutes INTEGER DEFAULT 30,           -- Code validity duration
  daily_limit_per_user INTEGER DEFAULT 2,      -- Max codes per user per day
  reuse_window_hours INTEGER DEFAULT 2,        -- Hours to reuse same code
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  
  -- Ensure only one settings row
  CONSTRAINT single_row CHECK (id = 1),
  CONSTRAINT valid_discount_type CHECK (discount_type IN ('percent', 'fixed'))
);

-- Insert default settings
INSERT INTO public.promo_settings (id) 
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read promo codes
CREATE POLICY "Allow authenticated read promo_codes" 
ON public.promo_codes 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow service role to manage promo codes
CREATE POLICY "Allow service role manage promo_codes" 
ON public.promo_codes 
FOR ALL 
USING (auth.role() = 'service_role');

-- Allow authenticated users to read settings
CREATE POLICY "Allow authenticated read promo_settings" 
ON public.promo_settings 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow service role to update settings
CREATE POLICY "Allow service role update promo_settings" 
ON public.promo_settings 
FOR UPDATE 
USING (auth.role() = 'service_role');

-- =====================================================
-- Helper Function: Auto-expire old codes
-- =====================================================

CREATE OR REPLACE FUNCTION expire_old_promo_codes()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.promo_codes
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE public.promo_codes IS 'Promotional discount codes for LINE chatbot users';
COMMENT ON TABLE public.promo_settings IS 'Global configuration for promo code system (single row)';
COMMENT ON COLUMN public.promo_codes.code IS 'Unique 6-digit promotional code';
COMMENT ON COLUMN public.promo_codes.status IS 'Code status: active, used, or expired';
COMMENT ON COLUMN public.promo_codes.discount_type IS 'Type of discount: percent or fixed amount';
COMMENT ON FUNCTION expire_old_promo_codes() IS 'Automatically expire codes past their expiry time';
