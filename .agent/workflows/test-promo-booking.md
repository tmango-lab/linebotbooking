---
description: Test promo code booking flow end-to-end
---

# Test Promo Code Booking Workflow

This workflow tests the complete promo code booking flow from LINE Bot to Admin Dashboard.

## Prerequisites
- LINE Bot is running
- Admin Dashboard is running (`npm run dev`)
- Supabase functions deployed
- Access to LINE Bot and Matchday Arena

## Steps

### Part 1: Generate Promo Code via LINE Bot

1. Open LINE Bot
2. Send message: `ค้นหาเวลา`
3. Select date (e.g., tomorrow)
4. Select duration (e.g., 1.5 Hours)
5. Find an available slot
6. Click on the slot to get booking details
7. **Copy the 6-digit promo code** displayed

### Part 2: Use Promo Code in Admin Dashboard

8. Open Admin Dashboard (`http://localhost:5173/admin/dashboard`)
9. Click **"ใช้โค้ดโปรโมชั่น"** button (green button)
10. Enter the 6-digit promo code
11. Click **"ตรวจสอบ"**

**Verify:**
- ✅ Court, date, time are correct
- ✅ Original price displayed
- ✅ Discount amount displayed
- ✅ **Final price** (after discount) displayed in green

12. Enter customer name (e.g., "ทดสอบโปรโมชั่น")
13. Enter phone number (e.g., "0812345678")
14. Click **"ยืนยันและจองเลย"**
15. Wait 5-7 seconds for confirmation

### Part 3: Verify LINE Notification

16. **Check LINE Bot for confirmation message**
17. Verify message contains:
    - ✅ Correct field name and player count
    - ✅ Correct date (in Thai Buddhist calendar)
    - ✅ Correct time slot
    - ✅ Original price, discount, and final price
    - ✅ Customer name and phone number
    - ✅ Payment instructions: "ชำระเงินได้ที่สนาม"
    - ✅ Cancellation contact: "083-914-4000"

### Part 4: Verify in Matchday Arena

18. Open Matchday Arena: `https://arena.matchday.co.th`
19. Login with your account
20. Find the booking you just created

**Verify Booking Card:**
- ✅ Price shows **discounted amount** (not original price)

**Verify Details Modal (click on booking):**
- ✅ Line item price shows **discounted amount**
- ✅ Total price shows **discounted amount**
- ✅ Description contains customer name and phone

## Expected Results

| Location | Expected Result |
|----------|----------------|
| Admin Dashboard | ✅ Discounted price (e.g., 450 THB) |
| LINE Notification | ✅ Confirmation message received |
| Matchday Booking Card | ✅ Discounted price (e.g., 450 THB) |
| Matchday Details Modal | ✅ Discounted price (e.g., 450 THB) |

## Troubleshooting

### Promo code validation fails
- Check code hasn't expired (30 min limit)
- Check code hasn't been used already
- Verify `validate-promo-code` function is deployed

### Booking created but price is wrong
- Check browser console (F12) for errors
- Look for `[Auto-Correct]` logs
- Verify `use-promo-code-and-book` function is deployed with latest code

### Matchday shows full price
- Wait 5-10 seconds and refresh
- Check that update payload includes `price` field
- Verify 5-second delay is in place

### LINE notification not received
- Check user has not blocked the LINE Bot
- Verify `LINE_CHANNEL_ACCESS_TOKEN` is configured
- Check function logs for `[Notification]` messages
- Note: Booking will still succeed even if notification fails

### Part 5: Stress Test (Anti-Gaming & Price Logic)

This verifies the system correctly handles dragging/resizing bookings with promo codes.

**Scenario A: Upsell (Increase Duration)**
21. Select the booking (e.g., 1 Hour).
22. Drag usage to extend to **1.5 Hours**.
23. **Verify Preview**: Price should increase (e.g., 600 -> 1000) but **Discount is RETAINED**.
24. Save.

**Scenario B: Revert (Fair Policy)**
25. Select the same booking (now 1.5 Hours).
26. Drag usage back to **1 Hour** (Original).
27. **Verify Preview**: Price should return to **Original Discounted Price** (e.g., 600).
28. Save. **Result**: Coupon still valid.

**Scenario C: Downsell (Gaming Attempt)**
29. Select the same booking (now 1 Hour).
30. Drag usage to **30 Minutes** (Below Original).
31. **Verify Preview**: Price should be standard rate (No Discount shown).
32. Save. **Result**: Coupon is **BURNED** (Status: `burned`, removed from booking).

