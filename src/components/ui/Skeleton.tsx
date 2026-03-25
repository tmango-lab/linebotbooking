/**
 * Skeleton — a pair of primitive building blocks for skeleton loaders.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32 rounded-lg" />          // single block
 *   <SkeletonCard>                                          // pre-built layouts
 *     ...
 *   </SkeletonCard>
 */

import React from 'react';

// ── Base Skeleton block ──────────────────────────────────────────────────────
interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
    return (
        <div
            className={`skeleton-shimmer rounded-lg ${className}`}
            style={style}
        />
    );
}

// ── Pre-built: Booking Grid Skeleton ─────────────────────────────────────────
// Shows 6 field columns × 8 time-slot rows of grey blocks
export function BookingGridSkeleton() {
    const COLS = 6;  // สนาม 1–6
    const ROWS = 8;  // time slots visible

    return (
        <div className="bg-[#F0F2F5] pt-2 pb-4">
            {/* Header bar (date pill area) */}
            <div className="px-4 pb-3 flex items-center gap-3">
                <Skeleton className="h-10 w-36 rounded-2xl" />
                <Skeleton className="h-10 w-10 rounded-full" />
            </div>

            {/* Column headers */}
            <div className="flex gap-1.5 px-2 mb-2">
                {Array.from({ length: COLS }).map((_, i) => (
                    <Skeleton key={i} className="h-6 flex-1 rounded-md" />
                ))}
            </div>

            {/* Slot grid */}
            <div className="flex flex-col gap-1.5 px-2">
                {Array.from({ length: ROWS }).map((_, row) => (
                    <div key={row} className="flex gap-1.5">
                        {Array.from({ length: COLS }).map((_, col) => (
                            <Skeleton key={col} className="h-10 flex-1 rounded-lg" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Pre-built: Coupon Card Skeleton ──────────────────────────────────────────
// Mimics a coupon card shape (icon left + text lines right)
export function CouponCardSkeleton() {
    return (
        <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm">
            {/* Icon / discount badge */}
            <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
            {/* Text lines */}
            <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
            </div>
            {/* "ใช้เลย" button placeholder */}
            <Skeleton className="h-8 w-16 rounded-full flex-shrink-0" />
        </div>
    );
}

// ── Pre-built: Wallet Page Skeleton ──────────────────────────────────────────
// Shows the points pill + 3 coupon cards
export function WalletSkeleton() {
    return (
        <div className="min-h-screen bg-[#F0F2F5]">
            {/* Points banner */}
            <div className="bg-gradient-to-br from-green-600 to-emerald-700 px-4 pt-10 pb-6">
                <Skeleton className="h-5 w-28 rounded mb-3" style={{ background: 'rgba(255,255,255,0.3)', backgroundSize: '800px 100%' }} />
                <Skeleton className="h-10 w-20 rounded-xl" style={{ background: 'rgba(255,255,255,0.3)', backgroundSize: '800px 100%' }} />
            </div>

            {/* Tab bar */}
            <div className="flex gap-2 px-4 py-3 bg-white shadow-sm">
                {['w-24', 'w-20', 'w-20'].map((w, i) => (
                    <Skeleton key={i} className={`h-8 ${w} rounded-full`} />
                ))}
            </div>

            {/* Coupon list */}
            <div className="flex flex-col gap-3 px-4 pt-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <CouponCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
