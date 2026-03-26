import { useQuery } from '@tanstack/react-query';
import type { Coupon } from './useBookingLogic';

interface CouponsResult {
    main: Coupon[];
    on_top: Coupon[];
    profile: { user_id: string; team_name: string; phone_number: string; role?: string } | null;
}

function parseCoupon(c: any): Coupon {
    const bValue = c.benefit?.value;
    let discountVal = 0;
    if (bValue) {
        if (typeof bValue === 'number') discountVal = bValue;
        else discountVal = bValue.amount || bValue.percent || 0;
    }
    return {
        id: c.coupon_id,
        campaign_id: c.campaign_id,
        name: c.name,
        discount_type: (bValue?.percent ? 'PERCENT' : 'FIXED') as 'FIXED' | 'PERCENT',
        discount_value: Number(discountVal),
        min_spend: Number(c.conditions?.min_spend) || 0,
        min_duration_minutes: Number(c.conditions?.min_duration_minutes) || 0,
        eligible_fields: c.conditions?.fields || null,
        eligible_days: c.conditions?.days || null,
        valid_time_start: c.conditions?.time?.start || null,
        valid_time_end: c.conditions?.time?.end || null,
        eligible_payments: c.conditions?.payment || null,
        category: (c.is_stackable ? 'ONTOP' : 'MAIN') as 'MAIN' | 'ONTOP',
        expiry: c.expiry,
        allow_ontop_stacking: c.is_stackable ? true : (c.allow_ontop_stacking ?? true),
    };
}

async function fetchCoupons(userId: string): Promise<CouponsResult> {
    const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-coupons`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ userId }),
        }
    );

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    if (!data.success) {
        return { main: [], on_top: [], profile: null };
    }

    return {
        main: (data.main || []).map(parseCoupon),
        on_top: (data.on_top || []).map(parseCoupon),
        profile: data.profile || null,
    };
}

/**
 * Cached hook for fetching a user's coupons.
 * staleTime: 5 minutes — coupons don't change every second.
 * Remember to call queryClient.invalidateQueries({ queryKey: ['coupons', userId] })
 * after a successful booking or coupon collection.
 */
export function useCouponsQuery(userId: string | null) {
    return useQuery<CouponsResult>({
        queryKey: ['coupons', userId],
        queryFn: () => fetchCoupons(userId!),
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: !!userId,   // Don't run until userId is known
    });
}

// Re-export the parser so WalletPage can use it too
export { parseCoupon };
