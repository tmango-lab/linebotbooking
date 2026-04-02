-- =============================================
-- Open Match Feature: Database Migration
-- Tables: open_matches, match_joiners
-- =============================================

-- 1. open_matches: ห้องประกาศหาคนแจม
CREATE TABLE IF NOT EXISTS public.open_matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id TEXT NOT NULL,                      -- FK ชี้ไปที่ bookings.booking_id
    host_user_id TEXT NOT NULL,                    -- LINE user ID ของ Host
    host_team_size INT NOT NULL DEFAULT 1,         -- กลุ่ม Host มีกี่คนแล้ว
    slots_total INT NOT NULL DEFAULT 1,            -- ต้องการ Joiner เพิ่มกี่คน
    slots_filled INT NOT NULL DEFAULT 0,           -- Joiner ที่จ่ายเงินแล้วกี่คน
    deposit_per_joiner INT NOT NULL,               -- มัดจำต่อ Joiner 1 คน (บาท)
    deposit_mode TEXT NOT NULL DEFAULT 'auto',     -- 'auto' = ระบบหารให้อัตโนมัติ
    note TEXT,                                     -- ข้อความเพิ่มเติมจาก Host
    skill_level TEXT NOT NULL DEFAULT 'casual',    -- casual, intermediate, competitive
    status TEXT NOT NULL DEFAULT 'open',           -- open, full, cancelled, expired
    host_consent_at TIMESTAMPTZ,                   -- เวลาที่ Host กดยอมรับเงื่อนไข
    expires_at TIMESTAMPTZ NOT NULL,               -- auto-expire (1 ชม. ก่อนเล่น)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT open_matches_status_check
        CHECK (status IN ('open', 'full', 'cancelled', 'expired')),
    CONSTRAINT open_matches_skill_check
        CHECK (skill_level IN ('casual', 'intermediate', 'competitive')),
    CONSTRAINT open_matches_deposit_mode_check
        CHECK (deposit_mode IN ('auto')),
    CONSTRAINT open_matches_slots_check
        CHECK (slots_total >= 1 AND slots_total <= 20),
    CONSTRAINT open_matches_team_size_check
        CHECK (host_team_size >= 1 AND host_team_size <= 30),
    CONSTRAINT open_matches_deposit_positive
        CHECK (deposit_per_joiner > 0),
    CONSTRAINT open_matches_filled_lte_total
        CHECK (slots_filled >= 0 AND slots_filled <= slots_total)
);

-- ป้องกัน 1 booking มีแค่ 1 open_match ที่ active อยู่
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_match
    ON public.open_matches(booking_id)
    WHERE status IN ('open', 'full');

-- Index สำหรับ query ห้องที่ยังเปิดอยู่ (Match Board)
CREATE INDEX IF NOT EXISTS idx_open_matches_status
    ON public.open_matches(status) WHERE status = 'open';

-- Index สำหรับ cron expire
CREATE INDEX IF NOT EXISTS idx_open_matches_expires
    ON public.open_matches(expires_at) WHERE status = 'open';

-- Index สำหรับ host lookup
CREATE INDEX IF NOT EXISTS idx_open_matches_host
    ON public.open_matches(host_user_id);


-- 2. match_joiners: รายชื่อ Joiner ที่เข้าร่วมห้อง
CREATE TABLE IF NOT EXISTS public.match_joiners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES public.open_matches(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,                         -- LINE user ID ของ Joiner
    status TEXT NOT NULL DEFAULT 'pending_payment', -- pending_payment, joined, refunded
    deposit_paid INT,                              -- จำนวนเงินที่จ่ายจริง (บาท)
    stripe_payment_intent_id TEXT,                 -- Stripe PI ID สำหรับ refund
    joiner_consent_at TIMESTAMPTZ,                 -- เวลาที่ Joiner กดยอมรับเงื่อนไข
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ป้องกัน Joiner ซ้ำในห้องเดียวกัน
    UNIQUE(match_id, user_id),

    CONSTRAINT match_joiners_status_check
        CHECK (status IN ('pending_payment', 'joined', 'refunded'))
);

-- Index สำหรับ lookup by match
CREATE INDEX IF NOT EXISTS idx_match_joiners_match
    ON public.match_joiners(match_id);

-- Index สำหรับ lookup by user
CREATE INDEX IF NOT EXISTS idx_match_joiners_user
    ON public.match_joiners(user_id);


-- 3. Atomic Function: จอง slot อย่างปลอดภัย (ป้องกัน race condition)
CREATE OR REPLACE FUNCTION public.try_join_match(
    p_match_id UUID,
    p_user_id TEXT,
    p_deposit INT,
    p_stripe_pi TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_joiner_id UUID;
BEGIN
    -- Lock the row to prevent concurrent joins
    SELECT * INTO v_match
    FROM public.open_matches
    WHERE id = p_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match not found');
    END IF;

    IF v_match.status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match is no longer open');
    END IF;

    IF v_match.slots_filled >= v_match.slots_total THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match is full');
    END IF;

    -- Check ว่า user นี้ join ไปแล้วยัง
    IF EXISTS (
        SELECT 1 FROM public.match_joiners
        WHERE match_id = p_match_id AND user_id = p_user_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already joined this match');
    END IF;

    -- Insert joiner record
    INSERT INTO public.match_joiners (match_id, user_id, status, deposit_paid, stripe_payment_intent_id, joiner_consent_at)
    VALUES (p_match_id, p_user_id, 'pending_payment', p_deposit, p_stripe_pi, NOW())
    RETURNING id INTO v_joiner_id;

    RETURN jsonb_build_object('success', true, 'joiner_id', v_joiner_id);
END;
$$;


-- 4. Atomic Function: ยืนยันการจ่ายเงินของ Joiner (เรียกจาก stripe-webhook)
CREATE OR REPLACE FUNCTION public.confirm_match_joiner(
    p_joiner_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_joiner RECORD;
    v_match RECORD;
    v_new_filled INT;
BEGIN
    -- ดึงข้อมูล joiner
    SELECT * INTO v_joiner
    FROM public.match_joiners
    WHERE id = p_joiner_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Joiner not found');
    END IF;

    IF v_joiner.status != 'pending_payment' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Joiner already processed');
    END IF;

    -- Update joiner status
    UPDATE public.match_joiners
    SET status = 'joined'
    WHERE id = p_joiner_id;

    -- Increment slots_filled
    UPDATE public.open_matches
    SET slots_filled = slots_filled + 1,
        updated_at = NOW()
    WHERE id = v_joiner.match_id
    RETURNING * INTO v_match;

    -- Check if match is now full
    v_new_filled := v_match.slots_filled;
    IF v_new_filled >= v_match.slots_total THEN
        UPDATE public.open_matches
        SET status = 'full', updated_at = NOW()
        WHERE id = v_joiner.match_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'match_id', v_joiner.match_id,
        'slots_filled', v_new_filled,
        'slots_total', v_match.slots_total,
        'is_full', v_new_filled >= v_match.slots_total,
        'host_user_id', v_match.host_user_id,
        'booking_id', v_match.booking_id
    );
END;
$$;


-- 5. RLS Policies (ปิด RLS เพราะ Edge Functions ใช้ service_role)
ALTER TABLE public.open_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_joiners ENABLE ROW LEVEL SECURITY;

-- Policy: ให้ service_role เข้าถึงได้ทั้งหมด
CREATE POLICY "Service role full access on open_matches"
    ON public.open_matches FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on match_joiners"
    ON public.match_joiners FOR ALL
    USING (true) WITH CHECK (true);

-- Policy: ให้ anon key อ่านข้อมูลห้องที่เปิดอยู่ได้ (สำหรับ LIFF Match Board)
CREATE POLICY "Anon can read open matches"
    ON public.open_matches FOR SELECT
    USING (status IN ('open', 'full'));

CREATE POLICY "Anon can read match joiners"
    ON public.match_joiners FOR SELECT
    USING (true);


-- 6. Grant Permissions
GRANT ALL ON public.open_matches TO postgres, service_role;
GRANT SELECT ON public.open_matches TO anon, authenticated;

GRANT ALL ON public.match_joiners TO postgres, service_role;
GRANT SELECT ON public.match_joiners TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.try_join_match TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_match_joiner TO postgres, service_role;
