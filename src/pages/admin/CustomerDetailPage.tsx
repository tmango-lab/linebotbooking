import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/api';
import {
    User, Phone, Calendar, ArrowLeft, Tag, X
} from 'lucide-react';

// Types
interface Profile {
    user_id: string;
    team_name: string;
    phone_number: string;
    created_at: string;
    tags?: string[];
    line_user_id?: string;
}

interface Booking {
    booking_id: string;
    date: string;
    time: string; // view helper might need adjustment if using time_from/time_to
    time_from: string;
    time_to: string;
    field_no: number;
    price_total_thb: number;
    status: string;
    payment_status: string;
    is_promo: boolean;
    court_name?: string; // helper
}

export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter/Tab State
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'coupons'>('upcoming');

    // Stats Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Bulk Action State
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);
    const [bulkReturnCoupon, setBulkReturnCoupon] = useState(false);

    useEffect(() => {
        if (id) fetchCustomerData(id);
    }, [id]);

    async function fetchCustomerData(userId: string) {
        setLoading(true);
        try {
            // 1. Get Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (profileError) throw profileError;
            setProfile(profileData);

            // 2. Get Bookings
            // Note: bookings able has user_id
            const { data: bookingData, error: bookingError } = await supabase
                .from('bookings')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false })
                .order('time_from', { ascending: true });

            if (bookingError) throw bookingError;
            setBookings(bookingData || []);

        } catch (err: any) {
            console.error('Error fetching customer details:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Tag Management
    const handleAddTag = async (tag: string) => {
        if (!tag || !profile) return;
        const currentTags = profile.tags || [];
        if (currentTags.includes(tag)) return;

        const newTags = [...currentTags, tag];
        await updateTags(newTags);
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!profile) return;
        const currentTags = profile.tags || [];
        const newTags = currentTags.filter(t => t !== tagToRemove);
        await updateTags(newTags);
    };

    const updateTags = async (newTags: string[]) => {
        if (!profile) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ tags: newTags })
                .eq('user_id', profile.user_id);

            if (error) throw error;

            // Optimistic update
            setProfile({ ...profile, tags: newTags });
        } catch (err: any) {
            alert('Error updating tags: ' + err.message);
        }
    };

    // Stats Calculation
    const stats = useMemo(() => {
        const total = bookings.length;
        const confirmed = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length;
        const cancelled = bookings.filter(b => b.status === 'cancelled').length;
        const revenue = bookings
            .filter(b => b.status === 'confirmed' || b.status === 'completed')
            .reduce((sum, b) => sum + (b.price_total_thb || 0), 0);

        const completionRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
        const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

        return { total, confirmed, cancelled, revenue, completionRate, cancellationRate };
    }, [bookings]);


    // Tabs Logic
    const filteredBookings = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        if (activeTab === 'upcoming') {
            return bookings.filter(b => b.date >= today && b.status !== 'cancelled').reverse(); // Show closest first? Actually API returns descending date.
            // If API sorts desc (newest first), upcoming:
            // older... [today] ...future
            // We want future bookings sorted by date asc (closest first) usually?
            // Let's re-sort for upcoming
            // But wait, original query is desc date.
        }
        if (activeTab === 'past') {
            return bookings.filter(b => b.date < today || b.status === 'cancelled');
        }
        return [];
    }, [bookings, activeTab]);

    // Sorting functionality for upcoming (Ascending)
    const displayBookings = useMemo(() => {
        if (activeTab === 'upcoming') {
            return [...filteredBookings].sort((a, b) => a.date.localeCompare(b.date));
        }
        return filteredBookings; // Past is already desc from API
    }, [filteredBookings, activeTab]);

    // Selection Logic
    const handleToggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleToggleAll = () => {
        const newSet = new Set(selectedIds);
        if (displayBookings.every(b => selectedIds.has(b.booking_id))) {
            displayBookings.forEach(b => newSet.delete(b.booking_id));
        } else {
            displayBookings.forEach(b => newSet.add(b.booking_id));
        }
        setSelectedIds(newSet);
    };

    const clearSelection = () => setSelectedIds(new Set());

    // Bulk Cancel Logic
    const handleBulkCancelClick = () => {
        if (selectedIds.size === 0) return;
        setShowBulkConfirm(true);
        setBulkReturnCoupon(false);
    };

    const confirmBulkCancel = async () => {
        setShowBulkConfirm(false);
        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        const token = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

        for (const bookingId of selectedIds) {
            try {
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-booking`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        matchId: bookingId,
                        reason: 'Admin Bulk Cancel (Customer Page)',
                        isRefunded: false, // Default text
                        shouldReturnCoupon: bulkReturnCoupon
                    })
                });

                if (!response.ok) throw new Error('Failed');
                successCount++;
            } catch (e) {
                failCount++;
                console.error(e);
            }
        }

        // Refresh data
        if (id) await fetchCustomerData(id);
        clearSelection();
        setLoading(false);
        // Could show toast/alert here
        alert(`Deleted ${successCount} bookings. ${failCount > 0 ? `Failed ${failCount}.` : ''}`);
    };


    if (loading) return <div className="p-8 text-center">Loading customer data...</div>;
    if (error || !profile) return <div className="p-8 text-center text-red-600">Error: {error || 'Customer not found'}</div>;

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => navigate('/admin/customers')}
                    className="flex items-center text-gray-500 hover:text-gray-900 mb-4 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
                </button>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl font-bold text-gray-900">{profile.team_name}</h1>
                            </div>

                            {/* Tags Management */}
                            <div className="flex flex-wrap gap-2 items-center mb-2">
                                {profile.tags?.map(tag => (
                                    <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ${tag === 'vip' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                        tag === 'inactive' ? 'bg-red-100 text-red-800 border-red-200' :
                                            'bg-gray-100 text-gray-700 border-gray-200'
                                        }`}>
                                        {tag}
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="hover:text-red-600 ml-1 p-0.5 rounded-full hover:bg-black/5 transaction-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    placeholder="+ tag"
                                    className="w-20 text-xs border border-gray-300 rounded-full px-2 py-0.5 focus:w-28 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAddTag(e.currentTarget.value);
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                                <div className="flex items-center gap-1">
                                    <Phone className="h-4 w-4" />
                                    {profile.phone_number || '-'}
                                </div>
                                <div className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    ID: {profile.user_id}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    Joined: {new Date(profile.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto mt-4 md:mt-0">
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
                                <div className="text-xs text-gray-500 mb-1">Total Bookings</div>
                                <div className="text-xl font-bold text-gray-900">{stats.total}</div>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-center">
                                <div className="text-xs text-green-600 mb-1">Revenue</div>
                                <div className="text-xl font-bold text-green-700">฿{stats.revenue.toLocaleString()}</div>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                                <div className="text-xs text-blue-600 mb-1">Completion</div>
                                <div className="text-xl font-bold text-blue-700">{stats.completionRate}%</div>
                            </div>
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-center">
                                <div className="text-xs text-red-600 mb-1">Cancelled</div>
                                <div className="text-xl font-bold text-red-700">{stats.cancellationRate}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'upcoming'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Upcoming Bookings
                </button>
                <button
                    onClick={() => setActiveTab('past')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'past'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    History
                </button>
                <button
                    onClick={() => setActiveTab('coupons')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'coupons'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Coupons
                </button>
            </div>

            {/* List */}
            {activeTab === 'coupons' ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-gray-200 border-dashed">
                    <Tag className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Coupons Feature Coming Soon</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {displayBookings.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No {activeTab} bookings found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {activeTab === 'upcoming' && (
                                            <th className="px-6 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={displayBookings.length > 0 && displayBookings.every(b => selectedIds.has(b.booking_id))}
                                                    onChange={handleToggleAll}
                                                />
                                            </th>
                                        )}
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Court</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {displayBookings.map(b => (
                                        <tr key={b.booking_id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(b.booking_id) ? 'bg-indigo-50' : ''}`}>
                                            {activeTab === 'upcoming' && (
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                        checked={selectedIds.has(b.booking_id)}
                                                        onChange={() => handleToggleSelection(b.booking_id)}
                                                    />
                                                </td>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {new Date(b.date).toLocaleDateString('th-TH', {
                                                        year: 'numeric', month: 'short', day: 'numeric', weekday: 'short'
                                                    })}
                                                </div>
                                                <div className="text-sm text-gray-500">{b.time_from.slice(0, 5)} - {b.time_to.slice(0, 5)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                สนาม {b.field_no}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${b.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                    b.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                        b.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                ฿{b.price_total_thb?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {/* Actions like view detail button could go here */}
                                                <button className="text-indigo-600 hover:text-indigo-900 font-medium text-xs">View</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-4 animate-in slide-in-from-bottom-4">
                    <span className="font-medium text-sm flex items-center">
                        <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mr-2">
                            {selectedIds.size}
                        </span>
                        Selected
                    </span>
                    <div className="h-4 w-px bg-gray-700"></div>
                    <button
                        onClick={handleBulkCancelClick}
                        className="text-red-400 hover:text-red-300 text-sm font-bold flex items-center gap-1 transition-colors"
                    >
                        Bulk Cancel
                    </button>
                    <div className="h-4 w-px bg-gray-700"></div>
                    <button
                        onClick={clearSelection}
                        className="text-gray-400 hover:text-white text-xs font-medium transition-colors"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Confirmation Modal */}
            {showBulkConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Cancel {selectedIds.size} bookings?</h3>
                        <p className="text-gray-500 text-sm mb-4">This action cannot be undone. Status will be changed to "cancelled".</p>

                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={bulkReturnCoupon}
                                    onChange={e => setBulkReturnCoupon(e.target.checked)}
                                    className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">Return Coupon to Customer</span>
                            </label>
                            <p className="text-xs text-gray-400 mt-1 ml-8">If selected, coupon status will be reset to Active.</p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowBulkConfirm(false)}
                                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBulkCancel}
                                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                            >
                                Confirm Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
