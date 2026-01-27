---
description: Deploy all Supabase Edge Functions
---

# Deploy All Functions Workflow

This workflow deploys all Supabase Edge Functions to production.

## Prerequisites
- Supabase CLI installed
- Logged in to Supabase (`npx supabase login`)
- Project linked (`npx supabase link`)

## Steps

// turbo
1. Deploy webhook function (LINE Bot)
```bash
npx supabase functions deploy webhook --no-verify-jwt
```

// turbo
2. Deploy create-booking function
```bash
npx supabase functions deploy create-booking --no-verify-jwt
```

// turbo
3. Deploy use-promo-code-and-book function
```bash
npx supabase functions deploy use-promo-code-and-book --no-verify-jwt
```

// turbo
4. Deploy validate-promo-code function
```bash
npx supabase functions deploy validate-promo-code --no-verify-jwt
```

// turbo
5. Deploy get-bookings function
```bash
npx supabase functions deploy get-bookings --no-verify-jwt
```

// turbo
6. Deploy cancel-booking function
```bash
npx supabase functions deploy cancel-booking --no-verify-jwt
```

// turbo
7. Deploy update-booking function
```bash
npx supabase functions deploy update-booking --no-verify-jwt
```

7. Verify deployment
```bash
npx supabase functions list
```

## Expected Output
All functions should show status "ACTIVE" with updated timestamps.

## Troubleshooting
- If deployment fails, check that you're logged in and linked to the correct project
- Verify environment variables are set in Supabase Dashboard
- Check function logs: `npx supabase functions logs <function-name>`
