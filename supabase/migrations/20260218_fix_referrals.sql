-- Fix Referrals Table Schema
-- Previous creation likely failed due to UUID type mismatch on booking_id FK
-- This script recreates the table with TEXT type for booking_id to match the timestamp ID used in app.

DROP TABLE IF EXISTS public.referrals;

CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id TEXT NOT NULL, -- References affiliates.user_id
    referee_id TEXT NOT NULL,  -- References profiles.user_id
    booking_id TEXT NOT NULL,  -- Stores the Booking Timestamp ID (e.g. "17714...")
    program_id UUID,           -- References referral_programs.id
    status TEXT DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('PENDING_PAYMENT', 'COMPLETED', 'CANCELLED')),
    reward_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(referee_id) -- Enforce 1 Referral per User
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Referrers can see their referrals" ON public.referrals
    FOR SELECT USING (referrer_id = auth.uid()::text);

CREATE POLICY "System can manage referrals" ON public.referrals
    FOR ALL USING (true);
