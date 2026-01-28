import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// @ts-ignore
const MD_TOKEN = Deno.env.get('MATCHDAY_TOKEN') || '';
const MD_BASE_URL = 'https://arena.matchday-backend.com';

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
// @ts-ignore
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

console.log("Migrate Matchday Data Function Started");

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const { startDate, endDate, dryRun } = await req.json();

        if (!startDate || !endDate) {
            return new Response(JSON.stringify({ error: 'startDate and endDate are required (YYYY-MM-DD)' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Migration] Start: ${startDate}, End: ${endDate}, DryRun: ${dryRun}`);

        // 1. Fetch from Matchday
        const url = `${MD_BASE_URL}/arena/matches`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': `Bearer ${MD_TOKEN}`,
                'Origin': 'https://arena.matchday.co.th'
            },
            body: JSON.stringify({
                time_start: `${startDate} 00:00:00`,
                time_end: `${endDate} 00:00:00`
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`Matchday API Error: ${res.status} - ${errorText}`);
            return new Response(JSON.stringify({ error: `Matchday API Error: ${errorText}` }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const matches = await res.json();
        console.log(`[Matchday] Retrieved ${matches.length} matches`);

        if (!Array.isArray(matches)) {
            return new Response(JSON.stringify({ error: 'Invalid response from Matchday' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 2. Transform Data
        const transformed = matches.map((m: any) => {
            const [date, timeStart] = m.time_start.split(' ');
            const [_, timeEnd] = m.time_end.split(' ');
            const timeFrom = timeStart.slice(0, 5); // "17:30"
            const timeTo = timeEnd.slice(0, 5);

            const startH = parseInt(timeFrom.split(':')[0]) + parseInt(timeFrom.split(':')[1]) / 60;
            const endH = parseInt(timeTo.split(':')[0]) + parseInt(timeTo.split(':')[1]) / 60;
            const duration = endH - startH;

            const price = m.total_price || m.price || m.fixed_price || 0;

            // Map Matchday court_id to local field_no
            // Matchday uses 2424, 2425, etc. but our fields table uses 1, 2, 3, etc.
            const courtToFieldMap: Record<number, number> = {
                2424: 1, // สนาม #1
                2425: 2, // สนาม #2
                2428: 3, // สนาม #3
                2426: 4, // สนาม #4
                2427: 5, // สนาม #5
                2429: 6  // สนาม #6
            };

            return {
                booking_id: String(m.id),
                user_id: 'MATCHDAY_IMPORT',
                field_no: courtToFieldMap[m.court_id] || null,
                date: date,
                time_from: timeFrom,
                time_to: timeTo,
                duration_h: duration.toFixed(1),
                price_total_thb: price,
                display_name: m.name || m.description || 'Unknown',
                status: m.cancel ? 'cancelled' : 'confirmed',
                source: 'MATCHDAY_IMPORT',
                is_promo: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        });

        // 3. Dry Run or Insert
        if (dryRun) {
            const samples = transformed.slice(0, 5);
            return new Response(JSON.stringify({
                dryRun: true,
                totalMatches: matches.length,
                samples: samples
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 4. Upsert to Database
        console.log(`[Database] Upserting ${transformed.length} records...`);

        const { data, error } = await supabase
            .from('bookings')
            .upsert(transformed, { onConflict: 'booking_id' });

        if (error) {
            console.error('[Database Error]:', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Success] Migrated ${transformed.length} records`);

        return new Response(JSON.stringify({
            success: true,
            totalMigrated: transformed.length,
            dateRange: { startDate, endDate }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Critical Error]:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
