import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Initialize Supabase Client (Ensure environment variables are set)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface UserProfile {
    user_id: string;
    team_name: string;
    phone_number: string;
    created_at?: string;
    updated_at?: string;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        // It's normal to not find a profile
        return null;
    }
    return data as UserProfile;
}

export async function upsertProfile(userId: string, teamName: string, phoneNumber: string): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .upsert({
            user_id: userId,
            team_name: teamName,
            phone_number: phoneNumber,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error('Error upserting profile:', error);
        throw error;
    }
}

export function parseProfileInput(text: string): { teamName: string; phoneNumber: string } | null {
    // Expected format: "TeamName PhoneNumber" or "TeamName Phone"
    // Heuristic: Last part is phone number if it looks like digits
    // OR First part is phone...
    // Let's assume standard format: "[Team Name] [Phone]"

    // Normalize spaces
    const parts = text.trim().split(/\s+/);

    if (parts.length < 2) {
        return null;
    }

    // Try to identify phone number (usually 9-10 digits, starts with 0)
    // Regex for Thai phone: ^0\d{8,9}$
    const phoneRegex = /^0\d{8,9}$/;

    let phone = '';
    let team = '';

    // Check last part
    const lastPart = parts[parts.length - 1];
    if (phoneRegex.test(lastPart) || (lastPart.length >= 9 && !isNaN(Number(lastPart)))) {
        phone = lastPart;
        team = parts.slice(0, parts.length - 1).join(' ');
    } else {
        // Maybe first part?
        const firstPart = parts[0];
        if (phoneRegex.test(firstPart)) {
            phone = firstPart;
            team = parts.slice(1).join(' ');
        } else {
            // Can't identify clearly, maybe provide best effort or fail?
            // Let's assume the user typed "Name 0xxxx" pattern as requested.
            // If we can't find a clear phone number, we will just take the last part as phone and hope.
            return null;
        }
    }

    // Clean up phone (remove dashes if any, though regex above assumes digits)
    phone = phone.replace(/-/g, '');

    return {
        teamName: team,
        phoneNumber: phone
    };
}
