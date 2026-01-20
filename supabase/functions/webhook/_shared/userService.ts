// supabase/functions/_shared/userService.ts

import { supabase } from './supabaseClient.ts';

// State interface (can be extended)
export interface UserState {
    date?: string;
    time_from?: string;
    duration_h?: number;
    field_no?: number;
    step?: string;
    [key: string]: any;
}

/**
 * Save or update user state
 */
export async function saveUserState(userId: string, state: UserState) {
    // 1. Get existing state to merge
    const { data: current } = await supabase
        .from('user_state')
        .select('state_data')
        .eq('user_id', userId)
        .single();

    const existingData = current?.state_data || {};
    const newData = { ...existingData, ...state };

    // 2. Upsert
    const { error } = await supabase
        .from('user_state')
        .upsert({
            user_id: userId,
            state_data: newData,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error('Save User State Error:', error);
    }
}

/**
 * Get user state
 */
export async function getUserState(userId: string): Promise<UserState> {
    const { data, error } = await supabase
        .from('user_state')
        .select('state_data')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        return {};
    }
    return data.state_data;
}

/**
 * Clear specific keys or reset state
 */
export async function clearUserState(userId: string) {
    await supabase.from('user_state').delete().eq('user_id', userId);
}
