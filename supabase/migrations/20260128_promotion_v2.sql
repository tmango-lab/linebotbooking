-- Campaigns (The Promotions)
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT, -- Added for UI details
  coupon_type TEXT CHECK (coupon_type IN ('MAIN', 'ONTOP')), -- MAIN = 1 per booking, ONTOP = many
  benefit_type TEXT CHECK (benefit_type IN ('DISCOUNT', 'REWARD', 'FIXED_PRICE')), -- Added FIXED_PRICE
  benefit_value JSONB, -- e.g. {"amount": 100} or {"percent": 10} or {"price": 600}
  
  -- Inventory & Limits
  total_quantity INT, -- Null = Unlimited
  remaining_quantity INT, -- Null = Unlimited
  limit_per_user INT DEFAULT 1,
  
  -- Acquisition
  secret_codes TEXT[], -- Array of codes triggers
  is_public BOOLEAN DEFAULT FALSE, -- If true, shows in public list. If false, need secret code.
  
  -- Constraints / Conditions (Explicit Columns for easy Querying)
  min_spend INT DEFAULT 0,
  eligible_fields INT[], -- e.g. [1, 2] meant Field 1 and 2 only. Null = All.
  payment_methods TEXT[], -- e.g. ['QR', 'CASH']. Null = All.
  allowed_time_range JSONB, -- e.g. {"start": "08:00", "end": "16:00"}
  days_of_week INT[], -- e.g. [1, 5] = Mon, Fri. 0=Sun. Null = All.
  
  -- UI Assets
  image_url TEXT, -- Banner image for Flex/Wallet
  
  -- Validity
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ, -- Campaign ends
  duration_days INT, -- Coupon validity after collected (e.g. 7 days). Null = Follow campaign end_date.

  status TEXT DEFAULT 'ACTIVE', -- ACTIVE, DRAFT, HIDDEN, EXPIRED
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Coupons (The Wallet)
CREATE TABLE user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT, -- LINE UID
  campaign_id UUID REFERENCES campaigns(id),
  status TEXT CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED')) DEFAULT 'ACTIVE',
  
  -- Snapshot of validity
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  booking_id TEXT -- Reference to booking when used
);

-- Indexes for performance
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_secret_codes ON campaigns USING GIN(secret_codes);
CREATE INDEX idx_user_coupons_user_id ON user_coupons(user_id);
CREATE INDEX idx_user_coupons_campaign_id ON user_coupons(campaign_id);
CREATE INDEX idx_user_coupons_status ON user_coupons(status);

-- RLS Policies (Enable RLS for security)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons ENABLE ROW LEVEL SECURITY;

-- Campaigns: Everyone can read active/public campaigns (for debugging/display), only service role can write
CREATE POLICY "Enable read access for all users" ON campaigns FOR SELECT USING (true);

-- User Coupons: Users can read their own coupons, Service role can do everything
CREATE POLICY "Users can view own coupons" ON user_coupons FOR SELECT USING (true); 
-- Note applied strict RLS later if auth is integrated, for now allowing read for dev ease (filtered by query)
