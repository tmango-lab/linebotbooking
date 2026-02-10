---
name: calculate_sports_field_price
description: Calculate football field reservation prices based on field type, time of day (pre/post 18:00), and special rounding rules.
---

# Sports Field Price Calculation Skill

> [!IMPORTANT]
> **Current System Architecture**: This project uses **Supabase Edge Functions (Deno)** for the LINE chatbot backend. The pricing logic is currently **inlined** in `supabase/functions/create-booking/index.ts` and mirrored in `src/pages/admin/DashboardPage.tsx` for the frontend.

This skill provides the definitive pricing logic for the football field reservation system.

## 1. Field Configuration & Base Rates

The prices differ based on the time of day, split at **18:00**.

| Field Name | Type | Matchday ID | Price Before 18:00 | Price After 18:00 |
|------------|------|-------------|--------------------|-------------------|
| **Field 1** | 5 คน | 2424 | **500** THB/hr | **700** THB/hr |
| **Field 2** | 5 คน | 2425 | **500** THB/hr | **700** THB/hr |
| **Field 3** | 7-8 คน | 2428 | **1000** THB/hr | **1200** THB/hr |
| **Field 4** | 7 คน | 2426 | **800** THB/hr | **1000** THB/hr |
| **Field 5** | 7 คน | 2427 | **800** THB/hr | **1000** THB/hr |
| **Field 6** | 7 คน (New) | 2429 | **1000** THB/hr | **1200** THB/hr |

## 2. Calculation Logic & Rounding Rules

The system splits a booking into two segments: **Pre-18:00** and **Post-18:00**.

### The "Dual Rounding" Rule
To ensure prices sum up intuitively for 30-minute slots, **each segment is calculated and rounded UP to the nearest 100 THB independently** if it contains a fraction.

**Formula:**
1.  **Calculate Pre-Cost:** `PreHours * PreRate`
    *   *If valid (>0) and not divisible by 100*: **Round UP** to nearest 100.
2.  **Calculate Post-Cost:** `PostHours * PostRate`
    *   *If valid (>0) and not divisible by 100*: **Round UP** to nearest 100.
3.  **Total:** `Round(PreCost + PostCost)`

### Example Calculation: Field 1 (17:30 - 18:30)
*   **Time:** 17:30 - 18:30 (1 Hour Total)
*   **Segments:**
    *   17:30 - 18:00 (30 mins = 0.5 hr) @ 500
    *   18:00 - 18:30 (30 mins = 0.5 hr) @ 700
*   **Step 1 (Pre):** 0.5 * 500 = 250 -> **Round UP to 300**
*   **Step 2 (Post):** 0.5 * 700 = 350 -> **Round UP to 400**
*   **Step 3 (Total):** 300 + 400 = **700 THB**

### Example Calculation: Field 1 (17:00 - 18:30)
*   **Time:** 17:00 - 18:30 (1.5 Hours)
*   **Segments:**
    *   17:00 - 18:00 (1.0 hr) @ 500
    *   18:00 - 18:30 (0.5 hr) @ 700
*   **Step 1 (Pre):** 1.0 * 500 = 500 (No rounding needed)
*   **Step 2 (Post):** 0.5 * 700 = 350 -> **Round UP to 400**
*   **Step 3 (Total):** 500 + 400 = **900 THB**

## 3. Anti-Gaming Policy (Discounts)

To prevent users from gaming the system (e.g., booking expensive slots with coupons and then switching to cheap slots or shorter times):

*   **Rule 1: Duration Shrink = Burn**: If a booking's duration is reduced (e.g. 1.5h -> 1h), any existing discount is **REMOVED**.
*   **Rule 2: Court Move = Safe**: If a booking is moved to a different court or time, checking only the duration. If the duration is the same (or longer), the discount is **PRESERVED**, even if the new court is cheaper.

## Implementation Snippet

```typescript
function calculatePrice(fieldId: number, startTime: string, durationHours: number) {
    // ... calculate preHours and postHours ...

    let prePrice = preHours * prices.pre;
    let postPrice = postHours * prices.post;

    // Apply Rounding Rule: Both Pre and Post prices round UP to nearest 100
    if (prePrice > 0 && prePrice % 100 !== 0) {
        prePrice = Math.ceil(prePrice / 100) * 100;
    }
    if (postPrice > 0 && postPrice % 100 !== 0) {
        postPrice = Math.ceil(postPrice / 100) * 100;
    }

    return Math.round(prePrice + postPrice);
}
```

## Supported Durations
- 1 Hour
- 1.5 Hours
- 2 Hours
- (System supports any duration, practically limited by 30-min slots)
