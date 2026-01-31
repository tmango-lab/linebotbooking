-- Add Micro-Conditions to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS eligible_fields INTEGER[] DEFAULT NULL, -- Array of field IDs (e.g. [1, 2])
ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT NULL, -- Array of methods (e.g. ['QR', 'CASH'])
ADD COLUMN IF NOT EXISTS valid_time_start TIME DEFAULT NULL, -- Start time (e.g. 08:00)
ADD COLUMN IF NOT EXISTS valid_time_end TIME DEFAULT NULL, -- End time (e.g. 16:00)
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL; -- Campaign Cover Image

-- Comment on columns
COMMENT ON COLUMN campaigns.eligible_fields IS 'List of Field IDs (1-6) that this campaign applies to. NULL = All Fields';
COMMENT ON COLUMN campaigns.payment_methods IS 'List of allowed payment methods. NULL = All Methods';
COMMENT ON COLUMN campaigns.valid_time_start IS 'Start of valid time range. NULL = No limit';
COMMENT ON COLUMN campaigns.valid_time_end IS 'End of valid time range. NULL = No limit';
