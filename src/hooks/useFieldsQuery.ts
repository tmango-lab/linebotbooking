import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/api';
import type { Field } from './useBookingLogic';

async function fetchFields(): Promise<Field[]> {
    const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('active', true)
        .order('id');

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map(f => ({
        id: f.id,
        name: f.label,
        type: f.type,
        price_pre: f.price_pre || 0,
        price_post: f.price_post || 0,
    }));
}

/**
 * Cached hook for fetching active fields.
 * staleTime: 60 minutes — fields rarely change.
 */
export function useFieldsQuery() {
    return useQuery<Field[]>({
        queryKey: ['fields'],
        queryFn: fetchFields,
        staleTime: 60 * 60 * 1000, // 60 minutes
    });
}
