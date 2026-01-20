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
