-- Add minimum duration constraint to campaigns table
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS min_duration_minutes INT DEFAULT 0;

COMMENT ON COLUMN public.campaigns.min_duration_minutes IS 'ระยะเวลาการจองขั้นต่ำ (นาที) ที่จะใช้คูปองนี้ได้ (เช่น 60 = 1 ชั่วโมง)';
