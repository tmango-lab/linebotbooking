// supabase/functions/_shared/supabaseClient.ts
// @ts-ignore: Deno is available in Deno runtime
declare const Deno: any;
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Create a generic client with Service Role (Admin Access)
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
