// src/lib/promoApi.ts
import { supabase } from './api';

// =====================================================
// Types
// =====================================================

export interface PromoCode {
    id: number;
    code: string;
    user_id: string;
    field_id: number;
    booking_date: string;
    time_from: string;
    time_to: string;
    duration_h: number;
    original_price: number;
    discount_type: 'percent' | 'fixed';
    discount_value: number;
    discount_amount: number;
    final_price: number;
    status: 'active' | 'used' | 'expired';
    used_at?: string;
    used_by?: string;
    created_at: string;
    expires_at: string;
    booking_id?: string;
    notes?: string;
}

export interface PromoSettings {
    id: number;
    enabled: boolean;
    discount_type: 'percent' | 'fixed';
    discount_value: number;
    min_booking_price: number;
    expiry_minutes: number;
    daily_limit_per_user: number;
    reuse_window_hours: number;
    updated_at?: string;
    updated_by?: string;
}

export interface PromoStats {
    total_codes: number;
    active_codes: number;
    used_codes: number;
    expired_codes: number;
    total_discount_given: number;
}

export interface HistoryFilters {
    status?: 'active' | 'used' | 'expired';
    dateFrom?: string;
    dateTo?: string;
    searchCode?: string;
    page?: number;
    pageSize?: number;
}

// =====================================================
// Validation & Usage
// =====================================================

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .single();

    if (error || !data) {
        return null;
    }

    return data;
}

export async function usePromoCode(code: string, adminId: string): Promise<boolean> {
    try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/use-promo-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ code, adminId })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Error from Edge Function:', result.error);
            return false;
        }

        return result.success;
    } catch (error) {
        console.error('Error calling Edge Function:', error);
        return false;
    }
}

// =====================================================
// Settings Management
// =====================================================

export async function getPromoSettings(): Promise<PromoSettings | null> {
    const { data, error } = await supabase
        .from('promo_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error || !data) {
        return null;
    }

    return data;
}

export async function updatePromoSettings(
    settings: Partial<PromoSettings>,
    adminId: string
): Promise<boolean> {
    const { error } = await supabase
        .from('promo_settings')
        .update({
            ...settings,
            updated_at: new Date().toISOString(),
            updated_by: adminId
        })
        .eq('id', 1);

    return !error;
}

// =====================================================
// History & Statistics
// =====================================================

export async function getPromoHistory(filters: HistoryFilters = {}): Promise<{
    data: PromoCode[];
    total: number;
}> {
    const {
        status,
        dateFrom,
        dateTo,
        searchCode,
        page = 1,
        pageSize = 20
    } = filters;

    let query = supabase
        .from('promo_codes')
        .select('*', { count: 'exact' });

    // Apply filters
    if (status) {
        query = query.eq('status', status);
    }

    if (dateFrom) {
        query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
        query = query.lte('created_at', dateTo);
    }

    if (searchCode) {
        query = query.ilike('code', `%${searchCode}%`);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query
        .order('created_at', { ascending: false })
        .range(from, to);

    const { data, error, count } = await query;

    if (error || !data) {
        return { data: [], total: 0 };
    }

    return { data, total: count || 0 };
}

export async function getPromoStats(): Promise<PromoStats> {
    // Get total counts by status
    const { data: allCodes, error } = await supabase
        .from('promo_codes')
        .select('status, discount_amount');

    if (error || !allCodes) {
        return {
            total_codes: 0,
            active_codes: 0,
            used_codes: 0,
            expired_codes: 0,
            total_discount_given: 0
        };
    }

    const stats = allCodes.reduce((acc: PromoStats, code: any) => {
        acc.total_codes++;

        if (code.status === 'active') acc.active_codes++;
        if (code.status === 'used') {
            acc.used_codes++;
            acc.total_discount_given += code.discount_amount || 0;
        }
        if (code.status === 'expired') acc.expired_codes++;

        return acc;
    }, {
        total_codes: 0,
        active_codes: 0,
        used_codes: 0,
        expired_codes: 0,
        total_discount_given: 0
    });

    return stats;
}

// =====================================================
// Field Info Helper
// =====================================================

export async function getFieldInfo(fieldId: number): Promise<{ label: string; type: string } | null> {
    const { data, error } = await supabase
        .from('fields')
        .select('label, type')
        .eq('id', fieldId)
        .single();

    if (error || !data) {
        return null;
    }

    return data;
}
