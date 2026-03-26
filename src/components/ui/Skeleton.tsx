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
                    <div className="flex flex-col items-start leading-tight">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-transparent skeleton-shimmer rounded select-none mb-0.5">เลือกวัน</span>
                        <span className="text-sm font-extrabold text-transparent skeleton-shimmer rounded select-none">วันนี้, 26 มี.ค.</span>
                    </div>
                    {/* chevron icon placeholder */}
                    <div className="w-5 h-5 skeleton-shimmer rounded-full" />
                </div>
                {/* Team name placeholder */}
                <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-transparent skeleton-shimmer rounded inline-block select-none mb-0.5">ทีม</div>
                    <div>
                        <span className="text-sm font-bold text-transparent skeleton-shimmer rounded select-none">MyTeamName</span>
                    </div>
                </div>
            </header>

            {/* ── Main: mirrors <div className="bg-white overflow-hidden…"> ── */}
            <main className="max-w-lg mx-auto">
                <div className="bg-white overflow-hidden border-b border-gray-200 shadow-sm relative">

                    {/* This div mirrors the actual scroll container of BookingGridVertical */}
                    <div className="overflow-x-auto bg-white max-h-[85vh] overflow-y-hidden relative">

                        {/* Sticky grid header: corners + field name columns */}
                        <div className="flex border-b border-gray-200 sticky top-0 z-20 bg-white shadow-sm">
                            {/* Corner "เวลา" cell */}
                            <div className="w-16 shrink-0 p-3 text-xs font-bold text-gray-400 border-r border-gray-100 flex items-center justify-center bg-gray-50 sticky left-0 z-30">
                                <span className="skeleton-shimmer rounded text-transparent select-none">เวลา</span>
                            </div>
                            {/* Field header cells */}
                            <div className="flex">
                                {Array.from({ length: FIELD_COUNT }).map((_, i) => (
                                    <div key={i} className="w-[80px] shrink-0 p-2 text-center border-r border-gray-100 last:border-r-0 bg-white">
                                        <div className="text-sm font-bold text-gray-800 truncate">
                                            <span className="skeleton-shimmer rounded text-transparent select-none">สนาม {i + 1}</span>
                                        </div>
                                        <div className="text-[10px] text-green-600 font-normal truncate mt-0.5">
                                            <span className="skeleton-shimmer rounded text-transparent select-none">XX คน</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Body rows: each row = time label + 6 slot cells */}
                        {Array.from({ length: ROW_COUNT }).map((_, row) => {
                            const timeStr = `${15 + Math.floor(row / 2)}:${row % 2 === 0 ? '00' : '30'}`;
                            return (
                                <div key={row} className="flex border-b border-gray-100 last:border-b-0">
                                    {/* Time cell */}
                                    <div className="w-16 shrink-0 p-2 text-xs text-gray-500 font-medium border-r border-gray-100 flex items-center justify-center bg-gray-50 sticky left-0 z-10">
                                        <span className="skeleton-shimmer rounded text-transparent select-none px-1">{timeStr}</span>
                                    </div>
                                    {/* Slot cells */}
                                    <div className="flex">
                                        {Array.from({ length: FIELD_COUNT }).map((_, col) => (
                                            <div key={col} className="w-[80px] shrink-0 h-12 border-r border-gray-100 last:border-r-0 bg-white" />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                    </div>
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
                <span className="skeleton-shimmer text-xs font-bold px-2 py-0.5 rounded-full text-transparent select-none">100 บาท</span>
            </div>
            {/* Title */}
            <h3 className="font-extrabold text-lg leading-tight mb-2">
                <span className="skeleton-shimmer rounded text-transparent select-none">ส่วนลดพิเศษฉลองเปิดสนามใหม่</span>
            </h3>
            {/* Subtitle */}
            <p className="text-sm">
                <span className="skeleton-shimmer rounded text-transparent select-none">หมดเขตสิ้นเดือนนี้</span>
            </p>
            {/* Divider */}
            <div className="my-4 border-t border-dashed border-gray-300" />
            {/* Footer row */}
            <div className="flex justify-between items-end">
                <div className="text-xs">
                    <span className="skeleton-shimmer rounded text-transparent select-none">รหัสคูปอง: XXXX</span>
                </div>
                <div className="h-8 w-16 skeleton-shimmer rounded-lg" />
            </div>
        </div>
    );
}

// ── WalletSkeleton ────────────────────────────────────────────────────────────
// Mirrors WalletPage exactly:
//   <div className="bg-white pt-8 px-6 pb-4 shadow-sm rounded-b-[2rem] sticky top-0 z-40">
//     h1 "กระเป๋าคูปอง" + points (orange) on right
//     tab bar: คูปองของฉัน | เก็บคูปอง | แลกแต้ม
//   </div>
//   then coupon cards below
export function WalletSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-20">

            {/* ── Header: mirrors the real sticky white header ── */}
            <div className="bg-white pt-8 px-6 pb-4 shadow-sm rounded-b-[2rem] mb-4 sticky top-0 z-40">
                {/* Title row + Points */}
                <div className="flex justify-between items-center mb-4">
                    {/* Left: title + subtitle */}
                    <div className="flex flex-col gap-1.5">
                        <h1 className="text-2xl font-extrabold">
                            <span className="skeleton-shimmer rounded text-transparent select-none">กระเป๋าคูปอง</span>
                        </h1>
                        <p className="text-sm" style={{ marginTop: '-4px' }}>
                            <span className="skeleton-shimmer rounded text-transparent select-none">ใช้คูปองส่วนลดที่นี่</span>
                        </p>
                    </div>
                    {/* Right: points number */}
                    <div className="flex flex-col items-end">
                        <div className="text-2xl font-black">
                            <span className="skeleton-shimmer rounded text-transparent select-none pl-4">XX</span>
                        </div>
                    </div>
                </div>

                {/* Tab bar: 3 equal-width buttons inside bg-gray-100 pill */}
                <div className="flex bg-gray-100 p-1 rounded-xl mb-4 gap-1">
                    <div className="flex-1 py-1.5 text-center text-sm font-bold">
                        <span className="skeleton-shimmer rounded text-transparent select-none">คูปองของฉัน</span>
                    </div>
                    <div className="flex-1 py-1.5 text-center text-sm font-bold">
                        <span className="skeleton-shimmer rounded text-transparent select-none">เก็บคูปอง</span>
                    </div>
                    <div className="flex-1 py-1.5 text-center text-sm font-bold">
                        <span className="skeleton-shimmer rounded text-transparent select-none">แลกแต้ม</span>
                    </div>
                </div>
            </div>

            {/* ── Coupon list ── */}
            <div className="px-5 space-y-4">
                <CouponCardSkeleton dark />
                <CouponCardSkeleton />
                <CouponCardSkeleton />
            </div>
        </div>
    );
}

