-- Refresh PostgREST schema cache to ensure new columns are visible
NOTIFY pgrst, 'reload config';
