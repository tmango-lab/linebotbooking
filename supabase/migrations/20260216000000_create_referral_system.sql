-- Create referral_programs table for global settings
CREATE TABLE IF NOT EXISTS public.referral_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    reward_amount NUMERIC NOT NULL DEFAULT 100, -- Amount for Referrer
    discount_percent NUMERIC NOT NULL DEFAULT 50, -- Discount for Referee
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ, -- Set to 2026-05-31
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active programs
CREATE POLICY "Everyone can read active programs" ON public.referral_programs
    FOR SELECT USING (true);
    
-- Policy: Only admins can update (assuming simple rule for now, ideally strictly admin)
CREATE POLICY "Admins can update programs" ON public.referral_programs
    FOR ALL USING (true) WITH CHECK (true); -- TODO: Restrict to admin role


-- Create affiliates table (The "Referrers")
CREATE TABLE IF NOT EXISTS public.affiliates (
    user_id TEXT PRIMARY KEY REFERENCES public.profiles(user_id),
    referral_code TEXT NOT NULL UNIQUE, -- e.g. Phone Number
    student_card_url TEXT, -- Path in Storage
    school_name TEXT,
    birth_date DATE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    total_earnings NUMERIC DEFAULT 0,
    total_referrals INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read own affiliate data
CREATE POLICY "Users can read own affiliate data" ON public.affiliates
    FOR SELECT USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own request
CREATE POLICY "Users can insert own affiliate request" ON public.affiliates
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Policy: Admins can update status (Simulated, allowing all for now to unblock dev)
CREATE POLICY "Admins can update affiliate status" ON public.affiliates
    FOR UPDATE USING (true);


-- Create referrals table (The "Transactions")
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id TEXT REFERENCES public.affiliates(user_id),
    referee_id TEXT REFERENCES public.profiles(user_id), -- The new user
    booking_id UUID REFERENCES public.bookings(id), -- Linked booking
    program_id UUID REFERENCES public.referral_programs(id),
    status TEXT DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('PENDING_PAYMENT', 'COMPLETED', 'CANCELLED')),
    reward_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(referee_id) -- One referral per new user (First time only)
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policy: Public read (for validating counts) or restricted?
CREATE POLICY "Referrers can see their referrals" ON public.referrals
    FOR SELECT USING (referrer_id = auth.uid()::text);
    
-- Policy: System can insert/update (Service Role usually bypasses, but good to have)
CREATE POLICY "System can manage referrals" ON public.referrals
    FOR ALL USING (true);


-- Seed the Default Program (Close School 2026)
INSERT INTO public.referral_programs (name, is_active, reward_amount, discount_percent, end_date)
VALUES ('โปรปิดเทอมใหญ่ 2026', true, 100, 50, '2026-05-31 23:59:59+07');
