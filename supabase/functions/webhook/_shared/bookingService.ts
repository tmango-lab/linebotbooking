// supabase/functions/_shared/bookingService.ts

import { supabase } from './supabaseClient.ts';
import { fetchMatchdayMatches, buildBusyIntervals } from './matchdayApi.ts';

// ===== OPTIMIZATION 1: Cache Fields Data =====
let fieldsCache: any[] | null = null;
let fieldsCacheTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get list of active fields (with caching)
 */
export async function getActiveFields() {
    const now = Date.now();

    // Return cached data if still valid
    if (fieldsCache && (now - fieldsCacheTime) < CACHE_DURATION_MS) {
        return fieldsCache;
    }

    // Fetch fresh data
    const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('active', true)
        .order('id');

    if (error) {
        console.error('Error fetching fields:', error);
        return fieldsCache || []; // Return old cache if available
    }

    // Update cache
    fieldsCache = data || [];
    fieldsCacheTime = now;

    return fieldsCache;
}

/**
 * Clear fields cache (call this if fields data changes)
 */
export function clearFieldsCache() {
    fieldsCache = null;
    fieldsCacheTime = 0;
}

/**
 * Check if a specific slot is free and find alternative slots if not
 * OPTIMIZED: Only checks Matchday API (no local bookings needed)
 */
export async function checkAvailability(fieldId: number, dateStr: string, startMin: number, durationMin: number) {
    // 1. Get Field Info
    const { data: field } = await supabase
        .from('fields')
        .select('matchday_court_id')
        .eq('id', fieldId)
        .single();

    if (!field) return { available: false, reason: 'field_not_found', altSlots: [] };

    // 2. Fetch Matchday bookings (only source of truth!)
    let matchdayBusy: Array<{ start: Date, end: Date }> = [];
    if (field.matchday_court_id) {
        try {
            const matches = await fetchMatchdayMatches(dateStr, field.matchday_court_id);
            matchdayBusy = buildBusyIntervals(matches);

            // Debug logging for Field 4
            if (fieldId === 4) {
                console.log(`[BOOKING DEBUG] Field 4 - Date: ${dateStr}, Court ID: ${field.matchday_court_id}`);
                console.log(`[BOOKING DEBUG] Field 4 - Matchday matches:`, JSON.stringify(matches));
                console.log(`[BOOKING DEBUG] Field 4 - Busy intervals: ${matchdayBusy.length}`);
                matchdayBusy.forEach((interval, idx) => {
                    console.log(`[BOOKING DEBUG] Field 4 Busy #${idx + 1}: ${interval.start.toISOString()} - ${interval.end.toISOString()}`);
                });
            }
        } catch (err) {
            console.error('Matchday API Error:', err);
            return { available: false, reason: 'api_error', altSlots: [] };
        }
    }

    // 3. Helper function to check if a slot is free (in-memory check)
    function isSlotFree(startMin: number, durMin: number): boolean {
        // Create date with Bangkok timezone (+07:00)
        const startDt = new Date(`${dateStr}T00:00:00+07:00`);
        startDt.setMinutes(startMin);

        // Add duration in milliseconds to avoid day overflow issues
        const endDt = new Date(startDt.getTime() + durMin * 60 * 1000);

        // Check Matchday bookings only
        const hasConflict = matchdayBusy.some(b => {
            return startDt < b.end && endDt > b.start;
        });

        return !hasConflict;
    }

    // 4. Check requested slot
    const available = isSlotFree(startMin, durationMin);

    if (fieldId === 4) {
        console.log(`[BOOKING DEBUG] Field 4 - Checking slot ${startMin}min (${minutesToTime(startMin)}) for ${durationMin}min`);
        console.log(`[BOOKING DEBUG] Field 4 - Result: ${available ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
    }

    if (available) {
        return { available: true, reason: '', altSlots: [] };
    }

    // 5. Find alternatives (fast - all in memory!)
    const suggestions: Array<{ from: string, to: string }> = [];
    const usedKeys = new Set<number>();
    const stepMin = 30;
    const maxTotal = 5;
    const dayStartMin = 0;
    const dayEndMin = 24 * 60;

    function addSuggestionIfFree(startMin: number) {
        if (usedKeys.has(startMin)) return;
        if (suggestions.length >= maxTotal) return;

        const endMin = startMin + durationMin;
        if (startMin < dayStartMin || endMin > dayEndMin) return;

        if (isSlotFree(startMin, durationMin)) {
            usedKeys.add(startMin);
            suggestions.push({
                from: minutesToTime(startMin),
                to: minutesToTime(endMin)
            });
        }
    }

    // Check slots before requested time (2 slots)
    for (let i = 1; i <= 2 && suggestions.length < maxTotal; i++) {
        addSuggestionIfFree(startMin - stepMin * i);
    }

    // Check slots after requested time (up to 3 hours from requested start)
    let cursor = startMin + stepMin;  // Start checking from 30 min after requested start
    const limit = startMin + 180;  // Up to 3 hours from requested start

    while (cursor < limit && suggestions.length < maxTotal) {
        addSuggestionIfFree(cursor);
        cursor += stepMin;
    }

    // Sort by time
    suggestions.sort((a, b) => {
        const aMin = timeToMinutes(a.from);
        const bMin = timeToMinutes(b.from);
        return aMin - bMin;
    });

    return { available: false, reason: 'slot_occupied', altSlots: suggestions };
}

/**
 * Convert minutes to HH:MM format
 */
function minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Convert HH:MM to minutes
 */
function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
