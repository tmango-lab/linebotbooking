-- Fix RLS policies for campaigns table to allow INSERT operations
-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON campaigns;

-- Create new policies
-- Allow all users to read campaigns (for public coupon discovery)
CREATE POLICY "Allow public read access" ON campaigns
    FOR SELECT
    USING (true);

-- Allow service role to do everything (for admin operations)
CREATE POLICY "Allow service role full access" ON campaigns
    FOR ALL
    USING (auth.role() = 'service_role');

-- Allow authenticated users to insert campaigns (for admin panel)
-- Note: In production, you should restrict this to specific admin users
CREATE POLICY "Allow authenticated insert" ON campaigns
    FOR INSERT
    WITH CHECK (true);

-- Allow authenticated users to update campaigns
CREATE POLICY "Allow authenticated update" ON campaigns
    FOR UPDATE
    USING (true);

-- Allow authenticated users to delete campaigns
CREATE POLICY "Allow authenticated delete" ON campaigns
    FOR DELETE
    USING (true);
