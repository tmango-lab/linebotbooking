ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS secret_codes TEXT[] DEFAULT NULL; -- Array of secret codes e.g. ['EARLYBIRD', 'VIP2024']
