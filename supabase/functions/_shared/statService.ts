// supabase/functions/_shared/statService.ts

import { supabase } from './supabaseClient.ts';

export interface StatLog {
    user_id?: string;
    source_type?: string;
    event_type?: string;
    action?: string;
    step?: string;
    label?: string;
    message_text?: string;
    postback_data?: string;
    process_ms?: number;
    extra_json?: any;
}

export async function logStat(entry: StatLog) {
    try {
        const { error } = await supabase.from('system_logs').insert(entry);
        if (error) {
            console.error('Log Stat DB Error:', error);
        }
    } catch (err) {
        console.error('Log Stat Exception:', err);
    }
}

/**
 * Log performance/system event
 */
export async function logPerf(label: string, startMs: number, extra?: any) {
    const ms = Date.now() - startMs;
    await logStat({
        source_type: 'system',
        event_type: 'system',
        action: 'perf',
        step: label,
        label: label,
        process_ms: ms,
        extra_json: extra
    });
}
