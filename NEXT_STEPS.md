# 🚀 System Status & Next Steps (Updated: 2026-04-04)

## Current State: Open Match (Shared Booking) — Beta Live ✅

### What's Been Implemented:
1.  ✅ **Open Match Feature (เปิดตี้)**: Host can open their booking for others to join and share cost
2.  ✅ **SetupMatchPage**: Host selects skill level, team size, joiner slots
3.  ✅ **MatchBoardPage**: Public match board with inline Stripe PromptPay payment
4.  ✅ **Stripe Payment Flow**: Joiner pays via QR PromptPay → auto-confirm via webhook
5.  ✅ **LINE Notifications**: Both Host and Joiner receive confirmation messages
6.  ✅ **Admin Dashboard Integration**: 🏟️ badge on BookingCard + full Open Match details in BookingDetailModal
7.  ✅ **Database**: `open_matches` + `match_joiners` tables with atomic RPC functions (race condition safe)

### Beta Limitations:
- `join-match` is gated to `TEST_USER_IDS` only
- Stripe charge amount is a test value (not full deposit)
- No refund/cancellation flow for joiners
- No cron job to auto-expire past matches

---

## Next Steps for Public Launch:

### 1. Remove Beta Gate (Priority: HIGH)
- **File**: `supabase/functions/join-match/index.ts`
- Remove `TEST_USER_IDS` array and the user check
- Update `stripeChargeAmount` to use full `depositAmount`
- Redeploy: `npx supabase functions deploy join-match`

### 2. Add Expiry Cron Job (Priority: MEDIUM)
- Create `cron-expire-matches` Edge Function
- Auto-set status to `expired` for open_matches where `expires_at < NOW()`
- Schedule via Supabase Cron or pg_cron

### 3. Joiner Cancellation/Refund (Priority: MEDIUM)
- Create `cancel-match-joiner` Edge Function
- Process Stripe refund via `stripe_payment_intent_id`
- Update `match_joiners.status` to `refunded`
- Decrement `open_matches.slots_filled`

### 4. Host Cancel Match (Priority: LOW)
- Allow Host to cancel their open match
- Auto-refund all confirmed joiners
- Set `open_matches.status` to `cancelled`

---

## Previously Completed Milestones:
- ✅ Premium Booking UI (V2/V3) with auto-apply coupons
- ✅ Standalone Booking System (migrated from Matchday)
- ✅ Promo Code & Referral System
- ✅ Admin Dashboard with drag-and-drop grid
- ✅ Stripe QR PromptPay payment with deposit locking
- ✅ LINE Bot integration for search & booking
- ✅ Admin LINE Notifications (real-time alerts)
- ✅ Attendance Nudge System
- ✅ LIFF Routing Guard (no route flash)

---
**Architecture Doc**: See `ARCHITECTURE.md` Section 27 for full Open Match technical details.
