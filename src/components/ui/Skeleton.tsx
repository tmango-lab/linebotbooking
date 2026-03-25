/**
 * Skeleton — pixel-accurate skeleton screens that mirror the real components.
 *
 * Each skeleton copies the exact Tailwind classes / dimensions from its
 * corresponding real component so there is ZERO layout shift on load.
 */

import React from 'react';

// ── Base shimmer block ────────────────────────────────────────────────────────
interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}
export function Skeleton({ className = '', style }: SkeletonProps) {
    return <div className={`skeleton-shimmer rounded-lg ${className}`} style={style} />;
}

// ── BookingGridSkeleton ───────────────────────────────────────────────────────
// Mirrors: BookingV3Page (header) + BookingGridVertical (grid)
// Exact sizes: w-16 time col, 6×w-[80px] field cols, h-12 row, sticky header

const FIELD_COUNT = 6;
// Match TIME_SLOTS.slice(0,-1) length = 18 rows
const ROW_COUNT = 18;

export function BookingGridSkeleton() {
    return (
        <div className="min-h-screen bg-[#F0F2F5] pb-32">

            {/* ── Header: mirrors <header> in BookingV3Page ── */}
            <header className="bg-white px-4 py-3 shadow-sm sticky top-0 z-50 flex justify-between items-center border-b border-gray-100">
                {/* Date pill button */}
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-100">
                    <div className="flex flex-col items-start leading-tight gap-1">
                        <Skeleton className="h-2.5 w-10 rounded" />
                        <Skeleton className="h-4 w-28 rounded" />
                    </div>
                    {/* chevron icon placeholder */}
                    <div className="w-5 h-5 skeleton-shimmer rounded-full" />
                </div>
                {/* Team name placeholder */}
                <div className="text-right flex flex-col items-end gap-1">
                    <Skeleton className="h-2.5 w-8 rounded" />
                    <Skeleton className="h-4 w-20 rounded" />
                </div>
            </header>

            {/* ── Main: mirrors <div className="bg-white overflow-hidden…"> ── */}
            <main className="max-w-lg mx-auto">
                <div className="bg-white overflow-hidden border-b border-gray-200 shadow-sm">

                    {/* Sticky grid header: corners + field name columns */}
                    <div className="flex border-b border-gray-200 sticky top-[57px] z-20 bg-white shadow-sm">
                        {/* Corner "เวลา" cell */}
                        <div className="w-16 shrink-0 p-3 border-r border-gray-100 bg-gray-50 flex items-center justify-center">
                            <Skeleton className="h-3 w-8 rounded" />
                        </div>
                        {/* Field header cells */}
                        <div className="flex">
                            {Array.from({ length: FIELD_COUNT }).map((_, i) => (
                                <div key={i} className="w-[80px] shrink-0 p-2 text-center border-r border-gray-100 last:border-r-0 bg-white flex flex-col items-center gap-1">
                                    <Skeleton className="h-4 w-8 rounded" />
                                    <Skeleton className="h-3 w-10 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body rows: each row = time label + 6 slot cells */}
                    {Array.from({ length: ROW_COUNT }).map((_, row) => (
                        <div key={row} className="flex border-b border-gray-100 last:border-b-0">
                            {/* Time cell */}
                            <div className="w-16 shrink-0 p-2 border-r border-gray-100 flex items-center justify-center bg-gray-50">
                                <Skeleton className="h-3 w-10 rounded" />
                            </div>
                            {/* Slot cells */}
                            <div className="flex">
                                {Array.from({ length: FIELD_COUNT }).map((_, col) => (
                                    <div key={col} className="w-[80px] shrink-0 h-12 border-r border-gray-100 last:border-r-0 skeleton-shimmer" />
                                ))}
                            </div>
                        </div>
                    ))}

                </div>
            </main>
        </div>
    );
}

// ── CouponCardSkeleton ────────────────────────────────────────────────────────
// Mirrors the dark gradient coupon card shape in WalletPage
export function CouponCardSkeleton({ dark = false }: { dark?: boolean }) {
    const base = dark
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-100';
    return (
        <div className={`rounded-2xl border p-5 ${base}`}>
            {/* Badge row */}
            <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            {/* Title */}
            <Skeleton className="h-5 w-3/4 rounded mb-2" />
            {/* Subtitle */}
            <Skeleton className="h-3 w-1/2 rounded" />
            {/* Divider */}
            <div className="my-4 border-t border-dashed border-gray-300" />
            {/* Footer row */}
            <div className="flex justify-between items-end">
                <Skeleton className="h-3 w-32 rounded" />
                <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
        </div>
    );
}

// ── WalletSkeleton ────────────────────────────────────────────────────────────
// Mirrors WalletPage: green header → tab bar → coupon list
export function WalletSkeleton() {
    return (
        <div className="min-h-screen bg-[#F0F2F5]">

            {/* Points header banner (green) */}
            <div className="bg-gradient-to-br from-green-600 to-emerald-700 px-6 pt-12 pb-8">
                <Skeleton className="h-3 w-24 rounded mb-3"
                    style={{ background: 'rgba(255,255,255,0.25)', backgroundSize: '800px 100%' }} />
                <Skeleton className="h-10 w-20 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.25)', backgroundSize: '800px 100%' }} />
                <Skeleton className="h-3 w-36 rounded mt-2"
                    style={{ background: 'rgba(255,255,255,0.2)', backgroundSize: '800px 100%' }} />
            </div>

            {/* Tab bar */}
            <div className="flex gap-2 px-4 py-3 bg-white shadow-sm border-b border-gray-100">
                {['w-24', 'w-20', 'w-20'].map((w, i) => (
                    <Skeleton key={i} className={`h-8 ${w} rounded-full`} />
                ))}
            </div>

            {/* Coupon list (1 dark main + 2 light on-top) */}
            <div className="flex flex-col gap-3 px-4 pt-4">
                <CouponCardSkeleton dark />
                <CouponCardSkeleton />
                <CouponCardSkeleton />
            </div>
        </div>
    );
}

