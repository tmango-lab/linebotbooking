import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { BarChart3, TrendingUp, TrendingDown, RefreshCw, Receipt, Tag } from 'lucide-react';

export default function ReportPage() {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        confirmedBookings: 0,
        cancelledBookings: 0,
        discountsGiven: 0,
        couponsUsed: 0,
        couponsBurned: 0
    });
    const [dateRange, setDateRange] = useState('today'); // today, week, month, all
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Helper to get date string YYYY-MM-DD
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

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
                const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
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

            console.log(`Fetching report for ${startStr} to ${endStr}`);

            // 1. Fetch Bookings
            const { data: bookings, error: bookingError } = await supabase
                .from('bookings')
                .select('*')
                .gte('date', startStr)
                .lte('date', endStr);

            if (bookingError) throw bookingError;

            // 2. Fetch Coupons (for Burned stats)
            // 'used_at' for USED coupons, 'updated_at' for BURNED coupons might be tricky if we don't track burned_at.
            // But we can check updated_at for approximate range.
            // Let's filtered by updated_at for burned coupons.
            const { data: coupons, error: couponError } = await supabase
                .from('user_coupons')
                .select('*')
                .in('status', ['used', 'burned'])
                .gte('updated_at', `${startStr}T00:00:00`)
                .lte('updated_at', `${endStr}T23:59:59`);

            if (couponError) throw couponError;

            // Calculate Stats
            let revenue = 0;
            let confirmed = 0;
            let cancelled = 0;
            let discounts = 0;
            let usedCount = 0;

            (bookings || []).forEach(b => {
                if (b.status === 'confirmed') {
                    confirmed++;
                    revenue += (b.price_total_thb || 0);

                    // Estimate Discount
                    // We don't explicitly store "discount amount" in a separate column in v1 (it was in note).
                    // But in V2 we might calculate it if we knew base price.
                    // For now, let's look for "admin_note" or rely on a "price_original" if we had it.
                    // Since we assume V2 is active, we might need to improve Data Model to store 'discount_value'.
                    // For NOW: Parse admin_note for "(-XXX)" or just calculate simple difference IF we knew standard price.
                    // Let's rely on 'admin_note' parsing as fallback for now.
                    if (b.admin_note && b.admin_note.includes('(-')) {
                        const match = b.admin_note.match(/\(-(\d+)\)/);
                        if (match) {
                            discounts += parseInt(match[1], 10);
                        }
                    }
                } else if (b.status === 'cancelled') {
                    cancelled++;
                }
            });

            // Count Coupons
            const burnedCount = (coupons || []).filter(c => c.status === 'burned').length;
            usedCount = (coupons || []).filter(c => c.status === 'used').length;

            setStats({
                totalRevenue: revenue,
                confirmedBookings: confirmed,
                cancelledBookings: cancelled,
                discountsGiven: discounts,
                couponsUsed: usedCount,
                couponsBurned: burnedCount
            });

        } catch (err: any) {
            console.error('Error fetching report:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-6 w-6" /> Financial Report
                </h1>

                <div className="flex items-center gap-2">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="custom">Custom Range</option>
                    </select>

                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2 bg-white p-1 rounded border border-gray-200">
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-sm border-none focus:ring-0 p-1" />
                            <span className="text-gray-400">-</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-sm border-none focus:ring-0 p-1" />
                        </div>
                    )}

                    <button
                        onClick={fetchReport}
                        className="ml-2 p-2 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100"
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Revenue */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Net Revenue</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-2">฿{stats.totalRevenue.toLocaleString()}</h3>
                        <p className="text-xs text-green-600 flex items-center mt-1">
                            <Receipt className="h-3 w-3 mr-1" /> {stats.confirmedBookings} Bookings
                        </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                </div>

                {/* Discounts */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Discounts Given</p>
                        <h3 className="text-2xl font-bold text-red-600 mt-2">-฿{stats.discountsGiven.toLocaleString()}</h3>
                        <p className="text-xs text-red-600 flex items-center mt-1">
                            From Coupons & Promos
                        </p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                        <Tag className="h-6 w-6 text-red-500" />
                    </div>
                </div>

                {/* Coupons Used */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Coupons Used</p>
                        <h3 className="text-2xl font-bold text-indigo-600 mt-2">{stats.couponsUsed}</h3>
                        <p className="text-xs text-gray-400 mt-1">Successfully redeemed</p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                        <TicketIcon className="h-6 w-6 text-indigo-600" />
                    </div>
                </div>

                {/* Coupons Burned */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Coupons Burned</p>
                        <h3 className="text-2xl font-bold text-orange-600 mt-2">{stats.couponsBurned}</h3>
                        <p className="text-xs text-orange-500 mt-1">Anti-Gaming / Expired</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg">
                        <TrendingDown className="h-6 w-6 text-orange-600" />
                    </div>
                </div>
            </div>

            {/* Hint / Warning */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <BarChart3 className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-blue-700">
                            <strong>Note:</strong> Discounts are estimated based on 'admin_note' parsing in existing booking data.
                            Burned coupons are counted based on 'updated_at' date.
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
