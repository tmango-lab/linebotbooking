const fs = require('fs');

const sql = fs.readFileSync('supabase/scripts/fix_trigger_points.sql', 'utf8');

const setupTemplate = `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const dbUrl = Deno.env.get('SUPABASE_DB_URL');
        if (!dbUrl) throw new Error('Missing SUPABASE_DB_URL');

        const client = new Client(dbUrl);
        await client.connect();

        const sql = \\\`${sql.replace(/`/g, '\\`')}\\\`;

        await client.queryArray(sql);
        await client.end();

        return new Response(JSON.stringify({ success: true, message: "Policies updated successfully" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
`;

fs.writeFileSync('supabase/functions/setup-db/index.ts', setupTemplate);
