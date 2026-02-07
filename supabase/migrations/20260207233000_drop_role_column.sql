-- Drop the legacy 'role' column as we have fully migrated to 'tags'
ALTER TABLE profiles DROP COLUMN IF EXISTS role;
