---
description: Fix LINE Bot not responding
---

# Fix LINE Bot Not Responding Workflow

This workflow helps troubleshoot and fix LINE Bot issues.

## Common Causes
1. Webhook function not deployed or outdated
2. Environment variables missing
3. Webhook URL not configured in LINE Developers Console

## Steps

### Step 1: Check Function Status

// turbo
1. List all functions
```bash
npx supabase functions list
```

**Verify:**
- `webhook` function shows status "ACTIVE"
- Check "UPDATED_AT" timestamp - should be recent

### Step 2: Redeploy Webhook

// turbo
2. Redeploy webhook function
```bash
npx supabase functions deploy webhook --no-verify-jwt
```

**This fixes 90% of cases** - stale deployment is the most common issue.

### Step 3: Test Bot

3. Send test message in LINE
   - Try: `จองสนาม`
   - Try: `ค้นหาเวลา`

**If bot responds:** ✅ Fixed! Stop here.

**If bot still doesn't respond:** Continue to Step 4.

### Step 4: Verify Environment Variables

4. Open Supabase Dashboard
   - Go to: `https://supabase.com/dashboard/project/kyprnvazjyilthdzhqxh/settings/functions`
   - Check these secrets exist:
     - `LINE_CHANNEL_ACCESS_TOKEN`
     - `LINE_CHANNEL_SECRET`
     - `MATCHDAY_TOKEN`

**If any are missing:** Add them and redeploy webhook.

### Step 5: Verify Webhook URL

5. Open LINE Developers Console
   - Go to: `https://developers.line.biz/console/`
   - Select your channel
   - Go to "Messaging API" tab
   - Check Webhook URL:
     ```
     https://kyprnvazjyilthdzhqxh.supabase.co/functions/v1/webhook
     ```
   - Verify "Use webhook" is enabled (green toggle)

6. Click **"Verify"** button next to Webhook URL

**If verification fails:** Check function logs for errors.

### Step 6: Check Function Logs

7. View webhook logs
```bash
# Note: Supabase CLI doesn't support logs command yet
# Check logs in Dashboard instead
```

Go to: `https://supabase.com/dashboard/project/kyprnvazjyilthdzhqxh/functions/webhook`

Look for errors in recent invocations.

## Expected Results
- Bot responds to `จองสนาม` with date selection
- Bot responds to `ค้นหาเวลา` with search mode selection

## Prevention
- Always redeploy webhook after editing shared modules
- Test bot after any deployment
- Keep environment variables backed up
