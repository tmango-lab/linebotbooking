// supabase/functions/_shared/matchdayApi.ts

// @ts-ignore: Deno is available in Deno runtime
declare const Deno: any;

const MD_TOKEN = Deno.env.get('MATCHDAY_TOKEN') || '';
const MD_BASE_URL = 'https://arena.matchday-backend.com';

interface MatchdayMatch {
    id: number;
    court_id: number;
    time_start: string; // "2025-11-18 18:00:00"
    time_end: string;
    [key: string]: any;
}

/**
 * Fetch matches from Matchday API for a specific date and court
 * @param dateStr "YYYY-MM-DD"
 * @param courtId Matchday Court ID
 */
export async function fetchMatchdayMatches(dateStr: string, courtId: number): Promise<MatchdayMatch[]> {
    if (!MD_TOKEN) {
        console.error('MATCHDAY_TOKEN is missing');
        return [];
    }

    const url = `${MD_BASE_URL}/arena/matches`;

    // Calculate time range: Start of day to Start of next day
    const timeStart = `${dateStr} 00:00:00`;

    // Parse date and add 1 day (use local date to avoid timezone issues)
    const [year, month, day] = dateStr.split('-').map(Number);
    const nextDay = new Date(year, month - 1, day + 1); // month is 0-indexed
    const yyyy = nextDay.getFullYear();
    const mm = ('0' + (nextDay.getMonth() + 1)).slice(-2);
    const dd = ('0' + nextDay.getDate()).slice(-2);
    const timeEnd = `${yyyy}-${mm}-${dd} 00:00:00`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': `Bearer ${MD_TOKEN}`,
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://arena.matchday.co.th'
            },
            body: JSON.stringify({
                time_start: timeStart,
                time_end: timeEnd
            })
        });

        if (!res.ok) {
            console.error(`Matchday API Error: ${res.status} - ${await res.text()}`);
            return [];
        }

        const data = await res.json();
        console.log(`[MATCHDAY API] Response: ${data.length} matches total`);

        if (!Array.isArray(data)) {
            console.warn('Matchday API returned non-array:', data);
            return [];
        }

        // Filter by court_id
        const filtered = data.filter((m: MatchdayMatch) => !courtId || m.court_id === courtId);
        console.log(`[MATCHDAY API] After filtering by court ${courtId}: ${filtered.length} matches`);

        if (courtId === 2426 && filtered.length > 0) {
            console.log(`[MATCHDAY API] Court 2426 matches:`, JSON.stringify(filtered));
        }

        return filtered;

    } catch (err) {
        console.error('Fetch Matchday Error:', err);
        return [];
    }
}

/**
 * Convert Matchday matches to "Busy Intervals"
 * IMPORTANT: Matchday API returns times in Bangkok timezone (Asia/Bangkok)
 * We need to parse them correctly to avoid timezone issues
 */
export function buildBusyIntervals(matches: MatchdayMatch[]) {
    return matches.map(m => {
        // Matchday sends "YYYY-MM-DD HH:mm:ss" in Bangkok time
        // Convert to ISO format and explicitly mark as Bangkok time
        // Example: "2026-01-16 19:31:00" -> "2026-01-16T19:31:00+07:00"
        const startStr = m.time_start.replace(' ', 'T') + '+07:00';
        const endStr = m.time_end.replace(' ', 'T') + '+07:00';

        const start = new Date(startStr);
        const end = new Date(endStr);

        return { start, end, raw: m };
    });
}

interface CreateBookingParams {
    courtId: number;
    timeStart: string; // "YYYY-MM-DD HH:mm:ss" - Local time (no timezone offset)
    timeEnd: string;   // "YYYY-MM-DD HH:mm:ss"
    customerName: string;
    phoneNumber: string;
    price?: number; // Optional fixed price
    note?: string;
}

/**
 * Create a booking in Matchday System
 */
export async function createMatchdayBooking(params: CreateBookingParams) {
    if (!MD_TOKEN) {
        throw new Error('MATCHDAY_TOKEN is missing');
    }

    const url = `${MD_BASE_URL}/arena/create-match`;

    // Construct payload
    const body = {
        courts: [params.courtId.toString()],
        time_start: params.timeStart,
        time_end: params.timeEnd,
        settings: {
            name: params.customerName,
            phone_number: params.phoneNumber,
            // Try to pass note in settings if supported, or could be separate field
            note: params.note || ''
        },
        payment: 'cash',
        method: 'fast-create',
        payment_multi: false,
        fixed_price: params.price || null, // Send calculated price here
        member_id: null,
        user_id: null
    };

    console.log('[MATCHDAY CREATE] Payload:', JSON.stringify(body));

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MD_TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Matchday Create Error: ${res.status} - ${errorText}`);
        throw new Error(`Failed to create booking on Matchday: ${errorText}`);
    }

    const data = await res.json();

    console.log('[MATCHDAY CREATE] Success:', data);

    // [MODIFIED] Price Override Logic
    // Handle both single match object and matches array (API varies)
    const createdMatch = data.match || (data.matches && data.matches[0]);

    if (params.price && createdMatch && createdMatch.id) {
        console.log(`[MATCHDAY API] Auto-correcting price for match ${createdMatch.id} to ${params.price}`);
        try {
            await updateMatchdayBooking(createdMatch.id, {
                time_start: params.timeStart,
                time_end: params.timeEnd,
                description: params.customerName,
                change_price: params.price
            });
            console.log(`[MATCHDAY API] Price auto-correction successful.`);
        } catch (err) {
            console.error(`[MATCHDAY API] Failed to auto-correct price for match ${createdMatch.id}:`, err);
        }
    }

    return data;
}

interface UpdateMatchPayload {
    time_start: string; // "YYYY-MM-DD HH:mm:ss"
    time_end: string;   // "YYYY-MM-DD HH:mm:ss"
    description?: string; // This corresponds to customer name or note in some contexts
    change_price?: number;
    cancel?: number;
    settings?: {
        name?: string;
        phone_number?: string;
        note?: string;
        [key: string]: any;
    };
}

/**
 * Update an existing match (booking) in Matchday System
 * Use cases: Edit price, Edit time, Edit details
 */
export async function updateMatchdayBooking(matchId: number, payload: UpdateMatchPayload) {
    if (!MD_TOKEN) {
        throw new Error('MATCHDAY_TOKEN is missing');
    }

    const url = `${MD_BASE_URL}/arena/match/${matchId}`;

    console.log(`[MATCHDAY UPDATE] Updating match ${matchId} with payload:`, JSON.stringify(payload));

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MD_TOKEN}`,
            'Origin': 'https://arena.matchday.co.th'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Matchday Update Error: ${res.status} - ${errorText}`);
        throw new Error(`Failed to update booking ${matchId} on Matchday: ${errorText}`);
    }

    const data = await res.json();
    console.log('[MATCHDAY UPDATE] Success:', data);
    return data;
}

/**
 * Cancel a booking in Matchday System
 */
export async function cancelMatchdayBooking(matchId: number, remark: string) {
    return updateMatchdayBooking(matchId, {
        // @ts-ignore: Partial update for cancellation
        time_start: "", // Not needed for cancel but payload type requires it? Check if we can omit.
        // Actually, let's just cheat the type or make type optional if specific fields are not needed for cancel.
        // Looking at the network log: {"cancel":1,"remark":"..."}
        // So we clearly don't need time_start/time_end.
        cancel: 1,
        remark: remark
    } as any);
}
