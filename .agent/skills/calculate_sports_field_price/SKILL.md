---
name: calculate_sports_field_price
description: Calculate football field reservation prices based on field type, time of day (pre/post 18:00), and special rounding rules.
---

# Sports Field Price Calculation Skill

> [!IMPORTANT]
> **Current System Architecture**: This project uses **Supabase Edge Functions (Deno)** for the LINE chatbot backend. The GAS folder contains legacy code used for learning and migration reference only.

This skill provides the pricing logic for calculating football field reservation prices. The pricing system is implemented in `supabase/functions/_shared/pricingService.ts`.

## Pricing Rules

### Field Types and Base Prices

| Field Type | Price Before 18:00 | Price After 18:00 |
|------------|-------------------|-------------------|
| 5-person   | 300 THB/hour      | 400 THB/hour      |
| 7-person   | 400 THB/hour      | 500 THB/hour      |
| 8-person   | 500 THB/hour      | 600 THB/hour      |
| 11-person  | 700 THB/hour      | 800 THB/hour      |

### Time-Based Pricing

- **Before 18:00** (06:00-17:59): Lower rate
- **After 18:00** (18:00-23:59): Higher rate

### Special Rounding Rules

When a booking crosses the 18:00 threshold, the system applies special rounding:

1. Calculate the portion before and after 18:00
2. Apply respective rates to each portion
3. Apply rounding rules based on the decimal portion:
   - If decimal ≥ 0.5: Round up to nearest 50 THB
   - If decimal < 0.5: Round down to nearest 50 THB

## Implementation

The pricing logic is located in:
```
supabase/functions/_shared/pricingService.ts
```

### Example Usage

```typescript
import { calculatePrice } from '../_shared/pricingService.ts';

// Calculate price for Field 1 (8-person), starting at 17:00 for 1.5 hours
const price = await calculatePrice(1, '17:00', 1.5);
// Result: 550 THB (0.5h @ 500 + 1h @ 600 = 850, rounded to 550)
```

## Database Schema

The `fields` table contains:
- `id`: Field ID
- `type`: Field type (e.g., "8 คน")
- `price_before_18`: Price per hour before 18:00
- `price_after_18`: Price per hour after 18:00
- `matchday_court_id`: Corresponding Matchday court ID
- `active`: Whether the field is active

## Notes

- All prices are in Thai Baht (THB)
- Minimum booking duration is typically 1 hour
- Supported durations: 1, 1.5, 2 hours
