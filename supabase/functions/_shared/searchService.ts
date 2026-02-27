// supabase/functions/_shared/searchService.ts

import { supabase } from './supabaseClient.ts';

const SEARCH_OPEN_TIME = '15:00';
const SEARCH_CLOSE_TIME = '24:00';
const SEARCH_STEP_MIN = 30; // 30-minute intervals (Grid System)

/**
 * Search all fields for available slots on a given date and duration
 * Uses Local Supabase Database Only
 */
export async function searchAllFieldsForSlots(dateStr: string, durationMin: number) {
    const { data: fields } = await supabase
        .from('fields')
        .select('*')
        .eq('active', true)
        .order('id');

    if (!fields) return {};

    const searchStartMin = getSearchStartMinute(dateStr);
    const endLimitMin = timeToMinute(SEARCH_CLOSE_TIME);

    console.log(`[SEARCH DEBUG] Date: ${dateStr}, Duration: ${durationMin}min`);
    console.log(`[SEARCH DEBUG] Search range: ${minuteToTime(searchStartMin)} - ${minuteToTime(endLimitMin)}`);

    // Fetch all bookings for this date from Local DB
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', dateStr)
        .neq('status', 'cancelled'); // Exclude cancelled bookings

    console.log(`[SEARCH DEBUG] Found ${bookings?.length || 0} bookings for ${dateStr}`);

    // Process all fields in parallel
    const fieldPromises = fields.map(async (field: any) => {
        const slots: Array<{ start: number, end: number }> = [];

        // Get bookings for this specific field
        const fieldBookings = (bookings || []).filter((b: any) => b.field_no === field.id);
        console.log(`[SEARCH DEBUG] Field ${field.id}: ${fieldBookings.length} bookings`);

        // Build busy intervals from local bookings
        const busyIntervals: Array<{ start: Date, end: Date }> = fieldBookings.map((b: any) => {
            // Normalize time to HH:MM:00 to avoid "16:00:00:00" invalid format
            const startStr = b.time_from.substring(0, 5); // Ensure HH:MM
            const endStr = b.time_to.substring(0, 5);     // Ensure HH:MM
            const start = new Date(`${b.date}T${startStr}:00+07:00`);
            const end = new Date(`${b.date}T${endStr}:00+07:00`);
            return { start, end };
        });

        // Log busy intervals for debugging
        busyIntervals.forEach((interval, idx) => {
            console.log(`[SEARCH DEBUG] Field ${field.id} Busy #${idx + 1}: ${interval.start.toISOString()} - ${interval.end.toISOString()}`);
        });

        // Helper to check if a slot is free
        function isSlotFree(startMin: number): boolean {
            // Create date with Bangkok timezone (+07:00)
            const startDt = new Date(`${dateStr}T00:00:00+07:00`);
            startDt.setMinutes(startMin);

            // Add duration in milliseconds
            const endDt = new Date(startDt.getTime() + durationMin * 60 * 1000);

            // Check for conflicts with existing bookings
            const hasConflict = busyIntervals.some(b => {
                const conflict = startDt < b.end && endDt > b.start;
                if (field.id === 6) {
                    console.log(`[SEARCH DEBUG] Field 6 Slot ${minuteToTime(startMin)}-${minuteToTime(startMin + durationMin)}: ${conflict ? 'BLOCKED' : 'FREE'} (slot: ${startDt.toISOString()} - ${endDt.toISOString()}, busy: ${b.start.toISOString()} - ${b.end.toISOString()})`);
                }
                return conflict;
            });

            return !hasConflict;
        }

        // Efficient 30-Minute Grid Search
        // Checks 16:00, 16:30, 17:00, etc.
        for (let start = searchStartMin; start + durationMin <= endLimitMin; start += SEARCH_STEP_MIN) {
            if (isSlotFree(start)) {
                slots.push({ start, end: start + durationMin });
            }
        }

        console.log(`[SEARCH DEBUG] Field ${field.id}: Found ${slots.length} available slots`);

        return { fieldId: field.id, slots };
    });

    // Wait for all fields to complete in parallel
    const fieldResults = await Promise.all(fieldPromises);

    // Convert array to object
    const results: Record<number, Array<{ start: number, end: number }>> = {};
    fieldResults.forEach(({ fieldId, slots }: any) => {
        results[fieldId] = slots;
    });

    return results;
}

/**
 * Get search start minute based on current time
 */
function getSearchStartMinute(dateStr: string): number {
    // Use Bangkok timezone
    const now = new Date();
    const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const todayStr = bangkokTime.toISOString().split('T')[0];

    console.log(`[SEARCH DEBUG] Current Bangkok time: ${bangkokTime.toISOString()}`);
    console.log(`[SEARCH DEBUG] Today: ${todayStr}, Search date: ${dateStr}`);

    // If searching for future date, start from SEARCH_OPEN_TIME
    if (dateStr !== todayStr) {
        return timeToMinute(SEARCH_OPEN_TIME);
    }

    // If today, start from next full hour or SEARCH_OPEN_TIME, whichever is later
    const openMin = timeToMinute(SEARCH_OPEN_TIME);
    const currentHour = bangkokTime.getHours();
    const currentMin = bangkokTime.getMinutes();

    // Round up to next hour
    const nextHourMin = currentMin === 0 ? currentHour * 60 : (currentHour + 1) * 60;

    const startMin = Math.max(openMin, nextHourMin);
    console.log(`[SEARCH DEBUG] Current: ${currentHour}:${currentMin}, Next hour: ${nextHourMin}min, Start: ${startMin}min`);

    return startMin;
}

function timeToMinute(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

export function minuteToTime(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// =====================================================
// Regular Booking Search (VIP)
// =====================================================

export interface RegularSlotResult {
    date: string;
    available: boolean;
    availableFieldIds: number[];
    reason?: string;
}

/**
 * Search availability for regular booking over a range of dates
 */
export async function searchRegularBookingSlots(
    startDate: string,
    endDate: string,
    targetDay: string, // e.g., "Tue", "Wed" - format depends on date.toDateString() or similar
    timeFrom: string,
    durationMin: number,
    specificFieldId?: number // [NEW] Optional
): Promise<RegularSlotResult[]> {
    console.log(`[Regular Search] ${startDate} to ${endDate} on ${targetDay}, ${timeFrom} (${durationMin}m)`);

    // 1. Generate eligible dates
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayMap: Record<string, number> = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
        'อาทิตย์': 0, 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัส': 4, 'ศุกร์': 5, 'เสาร์': 6
    };

    // Support Thai day names or English
    let targetDayIndex = -1;
    // Simple check
    for (const [key, val] of Object.entries(dayMap)) {
        if (targetDay.includes(key)) {
            targetDayIndex = val;
            break;
        }
    }

    // If user selected "ทุกวัน..." (Every...)
    // Let's assume input is like "Tue" or "Tuesday" from picker, or we handle it in handler.
    // For now, assume targetDay is matched against EN day names for simplicity, or handle both.
    // Let's rely on standard Date.getDay() (0-6)

    if (targetDayIndex === -1) {
        // Fallback or error
        console.error("Invalid target day:", targetDay);
        return [];
    }

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === targetDayIndex) {
            dates.push(d.toISOString().split('T')[0]);
        }
    }

    if (dates.length === 0) return [];

    // 2. Fetch active fields
    let query = supabase
        .from('fields')
        .select('id')
        .eq('active', true);

    if (specificFieldId) {
        query = query.eq('id', specificFieldId);
    }

    const { data: fields } = await query;

    if (!fields || fields.length === 0) return [];

    // 3. Process each date
    const results: RegularSlotResult[] = [];
    const startMin = timeToMinute(timeFrom);

    // Optimization: Fetch all bookings for the entire range in one go if range is small, 
    // but range could be a year. Safe to fetch per date or batch?
    // Let's fetch per date for now to keep it simple and robust (avoid memory issues with huge ranges).
    // Or fetch by range date >= start AND date <= end.

    // Fetch bookings for the whole range (filtered by dates roughly)
    // To avoid over-fetching, we can query `date` IN list, but list might be long.
    // Better: `date >= startDate` AND `date <= endDate`.
    // [FIX] Use .in() to fetch specific dates only to avoid 1000 row limit on large ranges
    const { data: allBookings, error } = await supabase
        .from('bookings')
        .select('date, time_from, time_to, field_no')
        .in('date', dates)
        .neq('status', 'cancelled')
        .limit(5000); // Verify higher limit just in case

    if (error) {
        console.error("Error fetching bookings:", error);
        return [];
    }

    for (const date of dates) {
        const dateBookings = (allBookings || []).filter((b: any) => b.date === date);
        const availableFields: number[] = [];

        for (const field of fields) {
            const fieldBookings = dateBookings.filter((b: any) => b.field_no === field.id);

            // Check collision
            const isBusy = fieldBookings.some((b: any) => {
                const bStart = timeToMinute(b.time_from.substring(0, 5));
                const bEnd = timeToMinute(b.time_to.substring(0, 5));
                const reqStart = startMin;
                const reqEnd = startMin + durationMin;

                // Collision: (StartA < EndB) and (EndA > StartB)
                return reqStart < bEnd && reqEnd > bStart;
            });

            if (!isBusy) {
                availableFields.push(field.id);
            }
        }

        results.push({
            date,
            available: availableFields.length > 0,
            availableFieldIds: availableFields,
            reason: availableFields.length === 0 ? 'Full' : undefined
        });
    }

    return results;
}
