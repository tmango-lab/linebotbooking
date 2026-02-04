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
    // 1. Clean input: remove quotes which might cause confusion
    const cleanText = text.trim().replace(/["']/g, '');

    // 2. Split by whitespace
    const parts = cleanText.split(/\s+/);

    if (parts.length < 2) {
        return null;
    }

    let phone = '';
    let phonePartIndex = -1;

    // 3. Identify which part is the phone number
    // Strategy: Look for a part that contains 9-10 digits
    // valid chars in phone part: digits, dashes, parens, plus
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Strip non-digits to check length
        const digits = part.replace(/\D/g, '');

        // Thai mobile: starts with 0, 10 digits. Landline: 02..., 9 digits.
        // We start with 0 check and length 9-10.
        if (digits.length >= 9 && digits.length <= 10 && digits.startsWith('0')) {
            phone = digits;
            phonePartIndex = i;
            break; // Found the phone number
        }
    }

    if (phonePartIndex === -1) {
        // Fallback: If no clear phone number found, maybe the user typed it without a leading 0?
        // Or maybe it's just the last part?
        // Let's be strict about the phone format to avoid capturing team names as phone numbers.
        return null;
    }

    // 4. Construct Team Name from the remaining parts
    const teamNameParts = parts.filter((_, index) => index !== phonePartIndex);
    const teamName = teamNameParts.join(' ');

    if (!teamName) {
        // No team name found (e.g. user just typed two phone numbers?)
        return null;
    }

    return {
        teamName,
        phoneNumber: phone
    };
}
