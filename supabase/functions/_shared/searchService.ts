// supabase/functions/_shared/searchService.ts

import { supabase } from './supabaseClient.ts';
import { fetchMatchdayMatches, buildBusyIntervals } from './matchdayApi.ts';

const SEARCH_OPEN_TIME = '16:00';
const SEARCH_CLOSE_TIME = '24:00';
const SEARCH_STEP_MIN = 30; // 30-minute intervals (Grid System)

/**
 * Search all fields for available slots on a given date and duration
 * OPTIMIZED: Parallel processing + fetch Matchday data once per field
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

    // ===== OPTIMIZATION 2: Parallel Processing =====
    // Process all fields in parallel instead of sequentially
    const fieldPromises = fields.map(async (field: any) => {
        const slots: Array<{ start: number, end: number }> = [];

        // Fetch Matchday data ONCE for this field
        let matchdayBusy: Array<{ start: Date, end: Date }> = [];
        if (field.matchday_court_id) {
            try {
                const matches = await fetchMatchdayMatches(dateStr, field.matchday_court_id);
                matchdayBusy = buildBusyIntervals(matches);
                console.log(`[SEARCH DEBUG] Field ${field.id}: ${matchdayBusy.length} busy intervals`);

                // Log each busy interval for debugging
                matchdayBusy.forEach((interval, idx) => {
                    console.log(`[SEARCH DEBUG] Field ${field.id} Busy #${idx + 1}: ${interval.start.toISOString()} - ${interval.end.toISOString()}`);
                });
            } catch (err) {
                console.error(`Matchday API Error for field ${field.id}:`, err);
            }
        }

        // Helper to check if a slot is free (in-memory only!)
        function isSlotFree(startMin: number): boolean {
            // Create date with Bangkok timezone (+07:00)
            const startDt = new Date(`${dateStr}T00:00:00+07:00`);
            startDt.setMinutes(startMin);

            // Add duration in milliseconds to avoid day overflow issues
            const endDt = new Date(startDt.getTime() + durationMin * 60 * 1000);

            // Check Matchday bookings
            const hasConflict = matchdayBusy.some(b => {
                const conflict = startDt < b.end && endDt > b.start;
                if (field.id === 6) {
                    console.log(`[SEARCH DEBUG] Field 6 Slot ${minuteToTime(startMin)}-${minuteToTime(startMin + durationMin)}: ${conflict ? 'BLOCKED' : 'FREE'} (slot: ${startDt.toISOString()} - ${endDt.toISOString()}, busy: ${b.start.toISOString()} - ${b.end.toISOString()})`);
                }
                return conflict;
            });

            return !hasConflict;
        }

        // Efficient 30-Minute Grid Search
        // Checks 08:00, 08:30, 09:00, etc.
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
