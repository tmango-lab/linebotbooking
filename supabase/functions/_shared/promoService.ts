// @ts-nocheck
// supabase/functions/_shared/promoService.ts

import { supabase } from './supabaseClient.ts';

// @ts-ignore: Deno is available in Deno runtime
declare const Deno: any;

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

export interface CreatePromoCodeParams {
    userId: string;
    fieldId: number;
    bookingDate: string;
    timeFrom: string;
    timeTo: string;
    durationH: number;
    originalPrice: number;
}

export interface DiscountResult {
    discountAmount: number;
    finalPrice: number;
}

// =====================================================
// Settings Management
// =====================================================

let settingsCache: PromoSettings | null = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getPromoSettings(): Promise<PromoSettings> {
    const now = Date.now();

    // Return cached settings if valid
    if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_DURATION) {
        return settingsCache;
    }

    const { data, error } = await supabase
        .from('promo_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error || !data) {
        console.error('Error fetching promo settings:', error);
        // Return default settings
        return {
            id: 1,
            enabled: true,
            discount_type: 'percent',
            discount_value: 10,
            min_booking_price: 500,
            expiry_minutes: 30,
            daily_limit_per_user: 2,
            reuse_window_hours: 2
        };
    }

    settingsCache = data;
    settingsCacheTime = now;

    return data;
}

export function clearSettingsCache() {
    settingsCache = null;
    settingsCacheTime = 0;
}

// =====================================================
// Code Generation
// =====================================================

/**
 * Generate a random 6-digit code (not sequential)
 * Ensures uniqueness by checking database
 */
export async function generatePromoCode(): Promise<string> {
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Generate random 6-digit number (100000-999999)
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Check if code already exists
        const { data, error } = await supabase
            .from('promo_codes')
            .select('code')
            .eq('code', code)
            .single();

        // If no data found, code is unique
        if (error && error.code === 'PGRST116') {
            return code;
        }

        // If found, try again
        console.log(`Code ${code} already exists, retrying...`);
    }

    throw new Error('Failed to generate unique promo code after 10 attempts');
}

// =====================================================
// Discount Calculation
// =====================================================

/**
 * Calculate discount based on settings
 * For percentage: rounds to nearest 10 THB
 * For fixed: uses exact amount
 */
export function calculateDiscount(
    price: number,
    settings: PromoSettings
): DiscountResult {
    let discountAmount = 0;

    if (settings.discount_type === 'percent') {
        // Calculate percentage discount
        const rawDiscount = (price * settings.discount_value) / 100;
        // Round to nearest 10 THB
        discountAmount = Math.round(rawDiscount / 10) * 10;
    } else {
        // Fixed amount discount
        discountAmount = Math.min(settings.discount_value, price);
    }

    const finalPrice = Math.max(0, price - discountAmount);

    return { discountAmount, finalPrice };
}

// =====================================================
// User Limit Checking
// =====================================================

/**
 * Check if user has reached daily limit
 * Returns true if user can still create codes
 */
export async function checkUserDailyLimit(
    userId: string,
    date: string
): Promise<boolean> {
    const settings = await getPromoSettings();

    const { count, error } = await supabase
        .from('promo_codes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('booking_date', date);

    if (error) {
        console.error('Error checking daily limit:', error);
        return false;
    }

    return (count || 0) < settings.daily_limit_per_user;
}

/**
 * Get active code within reuse window
 * Returns code if found, null otherwise
 */
export async function getActiveCodeInWindow(
    userId: string,
    bookingDate: string,
    fieldId: number
): Promise<PromoCode | null> {
    const settings = await getPromoSettings();
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - settings.reuse_window_hours);

    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('user_id', userId)
        .eq('booking_date', bookingDate)
        .eq('field_id', fieldId)
        .eq('status', 'active')
        .gte('created_at', windowStart.toISOString())
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        return null;
    }

    return data;
}

// =====================================================
// Main: Get or Create Promo Code
// =====================================================

/**
 * Get existing active code or create new one
 * Returns:
 * - PromoCode object if successful
 * - null if price below minimum
 * - 'LIMIT_REACHED' if user hit daily limit
 */
export async function getOrCreatePromoCode(
    params: CreatePromoCodeParams
): Promise<PromoCode | null | 'LIMIT_REACHED'> {
    const settings = await getPromoSettings();

    // Check if promo system is enabled
    if (!settings.enabled) {
        return null;
    }

    // Check minimum price requirement
    if (params.originalPrice < settings.min_booking_price) {
        return null;
    }

    // TEMPORARILY DISABLED: Code reuse to ensure correct pricing
    // Check for existing active code within reuse window
    // const existingCode = await getActiveCodeInWindow(
    //     params.userId,
    //     params.bookingDate,
    //     params.fieldId
    // );

    // if (existingCode) {
    //     console.log(`Reusing existing code ${existingCode.code} for user ${params.userId}`);
    //     return existingCode;
    // }

    // Check daily limit
    const canCreate = await checkUserDailyLimit(params.userId, params.bookingDate);
    if (!canCreate) {
        console.log(`User ${params.userId} reached daily limit`);
        return 'LIMIT_REACHED';
    }

    // Generate new code
    const code = await generatePromoCode();

    // Calculate discount
    const { discountAmount, finalPrice } = calculateDiscount(
        params.originalPrice,
        settings
    );

    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + settings.expiry_minutes);

    // Create promo code
    const { data, error } = await supabase
        .from('promo_codes')
        .insert({
            code,
            user_id: params.userId,
            field_id: params.fieldId,
            booking_date: params.bookingDate,
            time_from: params.timeFrom,
            time_to: params.timeTo,
            duration_h: params.durationH,
            original_price: params.originalPrice,
            discount_type: settings.discount_type,
            discount_value: settings.discount_value,
            discount_amount: discountAmount,
            final_price: finalPrice,
            status: 'active',
            expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating promo code:', error);
        return null;
    }

    console.log(`Created new promo code ${code} for user ${params.userId}`);
    return data;
}

// =====================================================
// Code Validation & Usage
// =====================================================

export interface ValidationResult {
    valid: boolean;
    code?: PromoCode;
    reason?: string;
}

/**
 * Validate promo code
 * Checks existence, status, and expiry
 */
export async function validatePromoCode(code: string): Promise<ValidationResult> {
    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .single();

    if (error || !data) {
        return { valid: false, reason: 'Code not found' };
    }

    if (data.status !== 'active') {
        return { valid: false, reason: `Code is ${data.status}`, code: data };
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    if (now > expiresAt) {
        // Auto-expire the code
        await supabase
            .from('promo_codes')
            .update({ status: 'expired' })
            .eq('id', data.id);

        return { valid: false, reason: 'Code has expired', code: data };
    }

    return { valid: true, code: data };
}

/**
 * Mark promo code as used
 */
export async function usePromoCode(
    code: string,
    adminUserId: string
): Promise<boolean> {
    const { error } = await supabase
        .from('promo_codes')
        .update({
            status: 'used',
            used_at: new Date().toISOString(),
            used_by: adminUserId
        })
        .eq('code', code)
        .eq('status', 'active');

    if (error) {
        console.error('Error using promo code:', error);
        return false;
    }

    return true;
}

/**
 * Cancel/expire a promo code
 */
export async function cancelPromoCode(code: string): Promise<boolean> {
    const { error } = await supabase
        .from('promo_codes')
        .update({ status: 'expired' })
        .eq('code', code)
        .eq('status', 'active');

    if (error) {
        console.error('Error canceling promo code:', error);
        return false;
    }

    return true;
}

// =====================================================
// Manual Promo Codes (VIP)
// =====================================================

export interface ManualPromoCode {
    id: number;
    code: string;
    discount_type: 'percent' | 'fixed';
    discount_value: number;
    min_price: number;
    max_discount: number | null;
    status: 'active' | 'inactive' | 'expired';
    usage_count?: number;
    usage_limit?: number;
}

/**
 * Validate manual promo code
 */
export async function validateManualPromoCode(code: string): Promise<{ valid: boolean; code?: ManualPromoCode; reason?: string }> {
    const { data, error } = await supabase
        .from('manual_promo_codes')
        .select('*')
        .eq('code', code)
        .single();

    if (error || !data) {
        return { valid: false, reason: 'Code not found' };
    }

    if (data.status !== 'active') {
        return { valid: false, reason: `Code is ${data.status}` };
    }

    return { valid: true, code: data as ManualPromoCode };
}

/**
 * Apply manual discount to a single booking price
 */
export function applyManualDiscount(price: number, promo: ManualPromoCode): { discount: number; finalPrice: number } {
    if (price < (promo.min_price || 0)) {
        return { discount: 0, finalPrice: price };
    }

    let discount = 0;
    if (promo.discount_type === 'fixed') {
        discount = Math.min(price, promo.discount_value);
    } else {
        // Percent
        discount = (price * promo.discount_value) / 100;
        if (promo.max_discount && discount > promo.max_discount) {
            discount = promo.max_discount;
        }
        // Round to nearest 10
        discount = Math.round(discount / 10) * 10;
    }

    return {
        discount,
        finalPrice: Math.max(0, price - discount)
    };
}
