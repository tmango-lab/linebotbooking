---
name: search_available_slots
description: Instructions for checking field availability using the 30-Minute Grid strategy.
---

# Skill: Search Available Slots

## Overview
This skill implements the logic for finding available booking slots across all fields. It uses a **30-Minute Grid** strategy to balance user flexibility with field utilization.

## Search Strategy: 30-Minute Grid
Instead of searching on the hour (e.g., 10:00, 11:00) or using complex gap-filling logic, the system standardizes on a 30-minute interval grid.

**Intervals**: 00, 30
**Start Times**: 08:00, 08:30, 09:00, 09:30, ... 22:30, 23:00.

### Why this strategy?
1.  **Flexibility**: Catches slots that start on the half-hour (e.g., 14:30) which hourly searches miss.
2.  **Simplicity**: Avoids complex logic to check "immediately after previous booking".
3.  **Predictability**: Users are accustomed to 30-minute increments.

## Algorithm
1.  **Define Search Window**:
    - Start: `Math.max(OpenTime, CurrentTime + Buffer)` (Rounded up to next 30 min)
    - End: `CloseTime` (24:00)
    - Step: `30 minutes`

2.  **Conflict Check**:
    - For each candidate start time `S`:
    - Calculate `E = S + Duration`
    - Check if `S < Booking.End` AND `E > Booking.Start` for any existing booking.
    - If `false`, the slot is **Available**.

## Usage in Code (`searchService.ts`)

```typescript
const SEARCH_STEP_MIN = 30; // Grid interval

// Loop through the day in 30-minute steps
for (let start = startMin; start + duration <= endMin; start += SEARCH_STEP_MIN) {
    if (isSlotFree(start)) {
        slots.push({ start, end: start + duration });
    }
}
```

## Best Practices
- **Do not revert to Hourly**: This will miss revenue opportunities (e.g., 1.5hr slot starting at 13:30).
- **Frontend Display**: Show results in a Carousel or List, sorted by time.
