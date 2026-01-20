---
name: matchday_booking
description: Guide and snippets for integrating booking functionality with the Matchday API.
---

# Matchday Booking Integration Skill

> [!IMPORTANT]
> **Current System Architecture**: This project uses **Supabase Edge Functions (Deno)** for the LINE chatbot backend. The GAS folder contains legacy code used for learning and migration reference only.

> [!NOTE]
> **Implementation Status**: The LINE chatbot currently allows customers to **check availability only**. Actual booking creation via LINE is **not yet implemented**, but this skill provides the necessary API details to add this functionality.

This skill provides details on how to programmatically create a booking in the Matchday system. This is useful for building custom booking interfaces (e.g., via LINE) that sync directly with Matchday's backend.

## API Endpoint Details

The booking creation is done via a direct `POST` request to the Matchday Arena backend.

- **Base URL:** `https://arena.matchday-backend.com`
- **Endpoint:** `/arena/create-match`
- **Method:** `POST`

## Headers

Required headers for the request:

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_MATCHDAY_TOKEN"
}
```

*Note: `YOUR_MATCHDAY_TOKEN` is the same token used for fetching matches.*

## Request Payload

The API expects a JSON body with the following structure:

```json
{
  "courts": ["2428"],           // Array of Court IDs (e.g., "2428" for 8-person field)
  "time_start": "2026-01-18 18:00:00", // Start time (YYYY-MM-DD HH:mm:ss)
  "time_end": "2026-01-18 19:30:00",   // End time
  "settings": {
    "name": "Customer Name",    // Name to display on booking
    "phone_number": "0812345678" // Customer phone number
  },
  "payment": "cash",            // Payment method (cash/transfer)
  "method": "fast-create",      // Booking mode
  "payment_multi": false,
  "fixed_price": null,
  "member_id": null,            // Optional: Matchday Member ID if known
  "user_id": null
}
```

## Implementation Example (Supabase Edge Function)

Here is a template function that can be added to `supabase/functions/_shared/matchdayApi.ts`:

```typescript
interface CreateBookingParams {
  courtId: string;
  timeStart: string; // "YYYY-MM-DD HH:mm:ss"
  timeEnd: string;   // "YYYY-MM-DD HH:mm:ss"
  customerName: string;
  phoneNumber: string;
}

export async function createMatchdayBooking(params: CreateBookingParams) {
  const MD_TOKEN = Deno.env.get('MATCHDAY_TOKEN');
  const url = 'https://arena.matchday-backend.com/arena/create-match';

  const body = {
    courts: [params.courtId],
    time_start: params.timeStart,
    time_end: params.timeEnd,
    settings: {
      name: params.customerName,
      phone_number: params.phoneNumber
    },
    payment: 'cash',
    method: 'fast-create'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MD_TOKEN}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Matchday API Error (${res.status}): ${errorText}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Booking failed:', error);
    throw error;
  }
}
```


## Important Notes
1.  **Court IDs:** Ensure you map your internal field IDs (e.g., Field 1, Field 2) to the correct Matchday Court IDs (e.g., 2428, 2429).
2.  **Timezone:** Ensure times are sent correctly. Matchday usually expects local time strings (e.g. `2026-01-18 18:00:00`) without timezone offsets in the string itself, but verify based on your specific server's locale if issues arise.
3.  **Time Display Normalization:** Matchday API returns booking times with a +1 minute offset (e.g., a booking for 18:00-19:30 is returned as 18:01-19:30). When displaying times to users, **subtract 1 minute from the start time only** to show the correct booking time. End times do not need adjustment.
   
   Example implementation:
   ```typescript
   function formatStartTime(dateTimeStr: string) {
       const date = new Date(dateTimeStr.replace(' ', 'T'));
       date.setMinutes(date.getMinutes() - 1);
       const hours = String(date.getHours()).padStart(2, '0');
       const minutes = String(date.getMinutes()).padStart(2, '0');
       return `${hours}:${minutes}`;
   }
   
   function formatEndTime(dateTimeStr: string) {
       return dateTimeStr.split(' ')[1].substring(0, 5); // No adjustment
   }
   ```

