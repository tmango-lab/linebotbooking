import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { BarChart3, TrendingUp, TrendingDown, RefreshCw, Receipt, Tag, CreditCard, Banknote, AlertTriangle, Info, Wallet } from 'lucide-react';

interface PaymentStats {
    // Overview
    totalRevenue: number;
    confirmedBookings: number;
    cancelledBookings: number;
    pendingBookings: number;
    couponDiscount: number;
    couponDiscountCount: number;
    referralDiscount: number;
    referralDiscountCount: number;
    couponsUsed: number;
    couponsBurned: number;
    // Payment Breakdown (confirmed only)
    stripeCount: number;
    stripeDepositTotal: number;
    stripeGrossTotal: number;
    cashCount: number;
    cashGrossTotal: number;
    qrCount: number;
    qrGrossTotal: number;
    // Forfeited Deposits (cancelled bookings that had stripe deposits)
    forfeitedCount: number;
    forfeitedDepositTotal: number;
    // Pending collection
    pendingCollectTotal: number;
}

const INITIAL_STATS: PaymentStats = {
    totalRevenue: 0,
    confirmedBookings: 0,
    cancelledBookings: 0,
    pendingBookings: 0,
    couponDiscount: 0,
    couponDiscountCount: 0,
    referralDiscount: 0,
    referralDiscountCount: 0,
    couponsUsed: 0,
    couponsBurned: 0,
    stripeCount: 0,
    stripeDepositTotal: 0,
    stripeGrossTotal: 0,
    cashCount: 0,
    cashGrossTotal: 0,
    qrCount: 0,
    qrGrossTotal: 0,
    forfeitedCount: 0,
    forfeitedDepositTotal: 0,
    pendingCollectTotal: 0,
};

export default function ReportPage() {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<PaymentStats>(INITIAL_STATS);
    const [dateRange, setDateRange] = useState('month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Helper: get YYYY-MM-DD using LOCAL date (not UTC), to avoid TZ offset issues
    const toDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    useEffect(() => {
        fetchReport();
    }, [dateRange, customStart, customEnd]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            let start = new Date();
            let end = new Date();

            if (dateRange === 'today') {
                // start/end is today
            } else if (dateRange === 'week') {
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                end.setDate(start.getDate() + 6);
            } else if (dateRange === 'month') {
                start = new Date(start.getFullYear(), start.getMonth(), 1);
                end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
            } else if (dateRange === 'custom') {
                if (!customStart || !customEnd) {
                    setLoading(false);
                    return;
                }
                start = new Date(customStart);
                end = new Date(customEnd);
            }

            const startStr = toDateStr(start);
            const endStr = toDateStr(end);

            // 1. Fetch Bookings (by service date)
            const { data: bookings, error: bookingError } = await supabase
                .from('bookings')
                .select('*')
                .gte('date', startStr)
                .lte('date', endStr);

            if (bookingError) throw bookingError;

            // 2. Fetch Coupons
            const { data: coupons, error: couponError } = await supabase
                .from('user_coupons')
                .select('*')
                .in('status', ['used', 'burned'])
                .gte('created_at', `${startStr}T00:00:00`)
                .lte('created_at', `${endStr}T23:59:59`);

            if (couponError) throw couponError;

            // Calculate all stats
            let revenue = 0;
            let confirmed = 0;
            let cancelled = 0;
            let pending = 0;
            let couponDiscount = 0;
            let couponDiscountCount = 0;
            let referralDiscount = 0;
            let referralDiscountCount = 0;

            // Payment channel breakdown (confirmed only)
            let stripeCount = 0;
            let stripeDepositTotal = 0;
            let stripeGrossTotal = 0;
            let cashCount = 0;
            let cashGrossTotal = 0;
            let qrCount = 0;
            let qrGrossTotal = 0;

            // Forfeited deposits (cancelled bookings that had Stripe deposits)
            let forfeitedCount = 0;
            let forfeitedDepositTotal = 0;

            (bookings || []).forEach(b => {
                const hasStripe = !!b.stripe_payment_intent_id;
                const price = b.price_total_thb || 0;
                const deposit = b.deposit_amount || 0;
                const method = (b.payment_method || '').toUpperCase();

                if (b.status === 'confirmed') {
                    confirmed++;
                    revenue += price;

                    // Payment channel classification
                    if (hasStripe) {
                        stripeCount++;
                        stripeDepositTotal += deposit;
                        stripeGrossTotal += price;
                    } else if (method === 'CASH' || !b.payment_method) {
                        cashCount++;
                        cashGrossTotal += price;
                    } else if (method === 'QR') {
                        qrCount++;
                        qrGrossTotal += price;
                    } else {
                        // fallback: treat as cash
                        cashCount++;
                        cashGrossTotal += price;
                    }

                    // Discount parsing - separate Coupon vs Referral
                    if (b.admin_note && b.admin_note.includes('(-')) {
                        const match = b.admin_note.match(/\(-(\d+)\)/);
                        if (match) {
                            const val = parseInt(match[1], 10);
                            if (b.admin_note.includes('[Referral]')) {
                                referralDiscount += val;
                                referralDiscountCount++;
                            } else if (b.admin_note.includes('[Coupon')) {
                                couponDiscount += val;
                                couponDiscountCount++;
                            }
                        }
                    }
                } else if (b.status === 'cancelled') {
                    cancelled++;
                    // Check forfeited deposits
                    if (hasStripe && deposit > 0) {
                        forfeitedCount++;
                        forfeitedDepositTotal += deposit;
                    }
                } else if (b.status === 'pending_payment') {
                    pending++;
                }
            });

            // Pending to collect at counter = gross revenue - stripe deposits already collected
            const pendingCollectTotal = revenue - stripeDepositTotal;

            // Count Coupons
            const burnedCount = (coupons || []).filter(c => c.status === 'burned').length;
            const usedCount = (coupons || []).filter(c => c.status === 'used').length;

            setStats({
                totalRevenue: revenue,
                confirmedBookings: confirmed,
                cancelledBookings: cancelled,
                pendingBookings: pending,
                couponDiscount,
                couponDiscountCount,
                referralDiscount,
                referralDiscountCount,
                couponsUsed: usedCount,
                couponsBurned: burnedCount,
                stripeCount,
                stripeDepositTotal,
                stripeGrossTotal,
                cashCount,
                cashGrossTotal,
                qrCount,
                qrGrossTotal,
                forfeitedCount,
                forfeitedDepositTotal,
                pendingCollectTotal,
            });

        } catch (err: any) {
            console.error('Error fetching report:', err);
        } finally {
            setLoading(false);
        }
    };

    const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) : '0';

    return (
        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-indigo-600" /> รายงานการเงิน
                </h1>

                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="today">วันนี้</option>
                        <option value="week">สัปดาห์นี้</option>
                        <option value="month">เดือนนี้</option>
                        <option value="custom">กำหนดเอง</option>
                    </select>

                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm">
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-sm border-none focus:ring-0 p-1" />
                            <span className="text-gray-400">→</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-sm border-none focus:ring-0 p-1" />
                        </div>
                    )}

                    <button
                        onClick={fetchReport}
                        className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION 1: Overview KPI Cards */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Revenue */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500">มูลค่าการเช่ารวม</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">฿{stats.totalRevenue.toLocaleString()}</h3>
                        <p className="text-xs text-green-600 flex items-center mt-1">
                            <Receipt className="h-3 w-3 mr-1" /> {stats.confirmedBookings} คิวยืนยัน
                        </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                </div>

                {/* Stripe Deposits Collected */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500">มัดจำ Stripe รับแล้ว</p>
                        <h3 className="text-2xl font-bold text-indigo-600 mt-1">฿{stats.stripeDepositTotal.toLocaleString()}</h3>
                        <p className="text-xs text-indigo-500 flex items-center mt-1">
                            <CreditCard className="h-3 w-3 mr-1" /> {stats.stripeCount} คิว
                        </p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                        <CreditCard className="h-6 w-6 text-indigo-600" />
                    </div>
                </div>

                {/* Pending Collection */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500">ยอดต้องเก็บหน้าสนาม</p>
                        <h3 className="text-2xl font-bold text-amber-600 mt-1">฿{stats.pendingCollectTotal.toLocaleString()}</h3>
                        <p className="text-xs text-amber-500 flex items-center mt-1">
                            <Wallet className="h-3 w-3 mr-1" /> เงินสด/QR ณ สนาม
                        </p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg">
                        <Banknote className="h-6 w-6 text-amber-600" />
                    </div>
                </div>

                {/* Forfeited Deposits */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500">มัดจำยึด (คิวยกเลิก)</p>
                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">฿{stats.forfeitedDepositTotal.toLocaleString()}</h3>
                        <p className="text-xs text-emerald-500 flex items-center mt-1">
                            <AlertTriangle className="h-3 w-3 mr-1" /> {stats.forfeitedCount} คิว
                        </p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION 2: Payment Channel Breakdown Table */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-indigo-500" />
                        สรุปช่องทางการชำระเงิน
                        <span className="text-xs font-normal text-gray-400 ml-2">(เฉพาะคิวยืนยัน)</span>
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ช่องทาง</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">จำนวนคิว</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">สัดส่วน</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">มัดจำรับแล้ว</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">มูลค่าสนามรวม</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {/* Stripe Row */}
                            <tr className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-indigo-500" />
                                        <span className="font-medium text-gray-800">QR(Stripe)</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-gray-900">{stats.stripeCount}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                                        {pct(stats.stripeCount, stats.confirmedBookings)}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-indigo-600">฿{stats.stripeDepositTotal.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-gray-700">฿{stats.stripeGrossTotal.toLocaleString()}</td>
                            </tr>

                            {/* Cash Row */}
                            <tr className="hover:bg-amber-50/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                                        <span className="font-medium text-gray-800">เงินสด / Admin</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-gray-900">{stats.cashCount}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                        {pct(stats.cashCount, stats.confirmedBookings)}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right text-gray-400">—</td>
                                <td className="px-6 py-4 text-right text-gray-700">฿{stats.cashGrossTotal.toLocaleString()}</td>
                            </tr>

                            {/* Total Row */}
                            <tr className="bg-gray-50 font-bold">
                                <td className="px-6 py-4 text-gray-800">รวมทั้งหมด</td>
                                <td className="px-6 py-4 text-right text-gray-900">{stats.confirmedBookings}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700">
                                        100%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right text-indigo-600">฿{stats.stripeDepositTotal.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-gray-900">฿{stats.totalRevenue.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Visual Bar */}
                {stats.confirmedBookings > 0 && (
                    <div className="px-6 py-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">ส่วนแบ่งช่องทาง (ตามจำนวนคิว)</p>
                        <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
                            {stats.stripeCount > 0 && (
                                <div
                                    className="bg-indigo-500 transition-all duration-500"
                                    style={{ width: `${pct(stats.stripeCount, stats.confirmedBookings)}%` }}
                                    title={`QR(Stripe): ${stats.stripeCount} คิว`}
                                />
                            )}
                            {stats.cashCount > 0 && (
                                <div
                                    className="bg-amber-500 transition-all duration-500"
                                    style={{ width: `${pct(stats.cashCount, stats.confirmedBookings)}%` }}
                                    title={`เงินสด/Admin: ${stats.cashCount} คิว`}
                                />
                            )}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> QR(Stripe) {pct(stats.stripeCount, stats.confirmedBookings)}%</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> เงินสด {pct(stats.cashCount, stats.confirmedBookings)}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION 3: Coupon & Discount Stats */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Coupon Discounts */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500">ส่วนลด (คูปอง)</p>
                        <h3 className="text-2xl font-bold text-red-600 mt-1">-฿{stats.couponDiscount.toLocaleString()}</h3>
                        <p className="text-xs text-red-500 flex items-center mt-1">{stats.couponDiscountCount} รายการ</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                        <Tag className="h-6 w-6 text-red-500" />
                    </div>
                </div>

                {/* Referral Discounts */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500">ส่วนลด (Referral)</p>
                        <h3 className="text-2xl font-bold text-purple-600 mt-1">-฿{stats.referralDiscount.toLocaleString()}</h3>
                        <p className="text-xs text-purple-500 flex items-center mt-1">{stats.referralDiscountCount} รายการ</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                        <TrendingDown className="h-6 w-6 text-purple-500" />
                    </div>
                </div>

                {/* Cancelled */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500">คิวยกเลิก</p>
                        <h3 className="text-2xl font-bold text-red-500 mt-1">{stats.cancelledBookings}</h3>
                        <p className="text-xs text-gray-400 mt-1">
                            {stats.confirmedBookings + stats.cancelledBookings > 0
                                ? `${((stats.cancelledBookings / (stats.confirmedBookings + stats.cancelledBookings)) * 100).toFixed(1)}% อัตรายกเลิก`
                                : '—'}
                        </p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                        <TrendingDown className="h-6 w-6 text-red-500" />
                    </div>
                </div>

                {/* Coupons Used */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500">คูปองที่ใช้</p>
                        <h3 className="text-2xl font-bold text-indigo-600 mt-1">{stats.couponsUsed}</h3>
                        <p className="text-xs text-gray-400 mt-1">แลกสำเร็จ</p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                        <TicketIcon className="h-6 w-6 text-indigo-600" />
                    </div>
                </div>

                {/* Coupons Burned */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500">คูปองถูกยึด</p>
                        <h3 className="text-2xl font-bold text-orange-600 mt-1">{stats.couponsBurned}</h3>
                        <p className="text-xs text-orange-500 mt-1">หมดอายุ / Anti-Gaming</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg">
                        <TrendingDown className="h-6 w-6 text-orange-600" />
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION 4: Disclaimer */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <Info className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-amber-800">
                            <strong>หมายเหตุ:</strong> รายงานนี้คำนวณจาก <strong>"วันที่ลูกค้ามาเข้าใช้บริการสนาม"</strong> (Service Date)
                            ไม่ใช่ "วันที่โอนเงิน" ดังนั้นยอดมัดจำ Stripe ในหน้านี้อาจไม่ตรงกับยอดเงินเข้าบัญชีธนาคาร (Payouts)
                            จาก Stripe ในเดือนเดียวกัน เนื่องจากการจ่ายมัดจำล่วงหน้าข้ามเดือน
                        </p>
                        <p className="text-xs text-amber-600 mt-2">
                            💡 สำหรับยอดเงินเข้าบัญชีจริง ให้ดาวน์โหลด CSV จาก Stripe Dashboard เพื่อเปรียบเทียบ
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TicketIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
        </svg>
    )
}
