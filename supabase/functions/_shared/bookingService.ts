// supabase/functions/_shared/bookingService.ts

import { supabase } from './supabaseClient.ts';

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
 * Uses Local Supabase Database Only
 */
export async function checkAvailability(fieldId: number, dateStr: string, startMin: number, durationMin: number) {
    // 1. Get Field Info
    const { data: field } = await supabase
        .from('fields')
        .select('*')
        .eq('id', fieldId)
        .single();

    if (!field) return { available: false, reason: 'field_not_found', altSlots: [] };

    // 2. Fetch bookings from Local DB
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('field_no', fieldId)
        .eq('date', dateStr)
        .neq('status', 'cancelled'); // Exclude cancelled bookings

    // Build busy intervals from local bookings
    const busyIntervals: Array<{ start: Date, end: Date }> = (bookings || []).map((b: any) => {
        // Normalize time to HH:MM:00 to avoid "16:00:00:00" invalid format
        const startStr = b.time_from.substring(0, 5); // Ensure HH:MM
        const endStr = b.time_to.substring(0, 5);     // Ensure HH:MM
        const start = new Date(`${b.date}T${startStr}:00+07:00`);
        const end = new Date(`${b.date}T${endStr}:00+07:00`);
        return { start, end };
    });

    // Debug logging for Field 4
    if (fieldId === 4) {
        console.log(`[BOOKING DEBUG] Field 4 - Date: ${dateStr}, Bookings: ${bookings?.length || 0}`);
        console.log(`[BOOKING DEBUG] Field 4 - Busy intervals: ${busyIntervals.length}`);
        busyIntervals.forEach((interval, idx) => {
            console.log(`[BOOKING DEBUG] Field 4 Busy #${idx + 1}: ${interval.start.toISOString()} - ${interval.end.toISOString()}`);
        });
    }

    // 3. Helper function to check if a slot is free (in-memory check)
    function isSlotFree(startMin: number, durMin: number): boolean {
        // Create date with Bangkok timezone (+07:00)
        const startDt = new Date(`${dateStr}T00:00:00+07:00`);
        startDt.setMinutes(startMin);

        // Add duration in milliseconds
        const endDt = new Date(startDt.getTime() + durMin * 60 * 1000);

        // Check for conflicts with existing bookings
        const hasConflict = busyIntervals.some(b => {
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
