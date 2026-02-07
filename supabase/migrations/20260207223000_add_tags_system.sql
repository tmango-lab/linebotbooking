-- Add tags column to profiles
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';

-- Migrate existing VIP roles to tags
-- This ensures 'vip' tag is added to users with role='vip', avoiding duplicates
UPDATE "public"."profiles"
SET "tags" = array_append("tags", 'vip')
WHERE "role" = 'vip' AND NOT ('vip' = ANY("tags"));

-- Create GIN index for faster array operations (searching by tag)
CREATE INDEX IF NOT EXISTS "profiles_tags_idx" ON "public"."profiles" USING GIN ("tags");
