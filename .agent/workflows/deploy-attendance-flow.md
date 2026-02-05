---
description: Deploy attendance-nudge and updated webhook
---

# Deploy Attendance Flow

This workflow deploys the new `attendance-nudge` function and updates the `webhook` function.

## Steps

// turbo
1. Deploy attendance-nudge function
```bash
npx supabase functions deploy attendance-nudge --no-verify-jwt
```

// turbo
2. Deploy webhook function
```bash
npx supabase functions deploy webhook --no-verify-jwt
```

3. Verify deployment
```bash
npx supabase functions list
```
