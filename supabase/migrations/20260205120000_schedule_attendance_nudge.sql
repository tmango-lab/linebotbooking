-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the job for 11:00 AM Bangkok Time (UTC+7) -> 04:00 AM UTC
-- Note: cron.schedule will UPDATE the job if it already exists with the same name.
-- Function URL: https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/attendance-nudge

select cron.schedule(
    'attendance-nudge-daily',
    '0 4 * * *', 
    $$
    select
        net.http_post(
            url:='https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/attendance-nudge',
            headers:='{"Content-Type": "application/json"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);
