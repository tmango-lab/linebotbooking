import { useQuery } from '@tanstack/react-query';

// Court ID reverse-map (Matchday API ID → display ID 1-6)
const reverseMap: Record<number, number> = {
    2424: 1, 2425: 2, 2428: 3, 2426: 4, 2427: 5, 2429: 6
};

async function fetchBookings(date: string): Promise<any[]> {
    const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-bookings`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ date }),
        }
    );

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    // Normalize court_id to display IDs 1–6
    return (data.bookings || []).map((b: any) => ({
        ...b,
        court_id: reverseMap[b.court_id] || b.court_id,
    }));
}

/**
 * Cached hook for fetching bookings for a specific date.
 * staleTime: 30 seconds — bookings change frequently.
 * The queryKey includes the date so switching days auto-refetches.
 */
export function useBookingsQuery(date: string) {
    return useQuery<any[]>({
        queryKey: ['bookings', date],
        queryFn: () => fetchBookings(date),
        staleTime: 30 * 1000, // 30 seconds
        enabled: !!date,
    });
}
