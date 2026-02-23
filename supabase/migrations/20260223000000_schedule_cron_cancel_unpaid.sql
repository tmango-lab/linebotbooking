-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the job to run every 5 minutes
-- Note: cron.schedule will UPDATE the job if it already exists with the same name.
-- Function URL: https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/cron-cancel-unpaid

select cron.schedule(
    'cron-cancel-unpaid-every-5m',
    '*/5 * * * *', 
    $$
    select
        net.http_post(
            url:='https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/cron-cancel-unpaid',
            headers:='{"Content-Type": "application/json"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);
