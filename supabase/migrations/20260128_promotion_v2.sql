-- Campaigns (The Promotions)
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  coupon_type TEXT CHECK (coupon_type IN ('MAIN', 'ONTOP')), -- MAIN = 1 per booking, ONTOP = many
  benefit_type TEXT CHECK (benefit_type IN ('DISCOUNT', 'REWARD')), -- MONEY vs ITEM
  benefit_value JSONB, -- e.g. {"amount": 100} or {"item": "Water Pack"}
  total_quantity INT,
  remaining_quantity INT, -- Added to track inventory
  limit_per_user INT DEFAULT 1,
  secret_codes TEXT[], -- Array of codes for offline redemption
  conditions JSONB, -- e.g. {"min_spend": 500, "payment_methods": ["QR"]}
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Coupons (The Wallet)
CREATE TABLE user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT, -- LINE UID
  campaign_id UUID REFERENCES campaigns(id),
  status TEXT CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED')) DEFAULT 'ACTIVE',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_secret_codes ON campaigns USING GIN(secret_codes);
CREATE INDEX idx_user_coupons_user_id ON user_coupons(user_id);
CREATE INDEX idx_user_coupons_campaign_id ON user_coupons(campaign_id);

-- RLS Policies (Enable RLS for security)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons ENABLE ROW LEVEL SECURITY;

-- Campaigns: Everyone can read active campaigns (for debugging/display), only service role can write
CREATE POLICY "Enable read access for all users" ON campaigns FOR SELECT USING (true);

-- User Coupons: Users can read their own coupons, Service role can do everything
CREATE POLICY "Users can view own coupons" ON user_coupons FOR SELECT USING (auth.uid()::text = user_id OR user_id IS NULL); 
-- Note: logic usually handled by Edge Function with Service Role, so strictly speaking RLS might be bypassed there, 
-- but good to have for direct client access if needed.
