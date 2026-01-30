import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { Loader2, Ticket, Gift, Lock, Send } from 'lucide-react';
import CouponSelectionModal from '../../components/ui/CouponSelectionModal';

interface Coupon {
    id: string; // user_coupon_id
    campaign_id: string;
    name: string;
    description?: string;
    benefit_type: 'DISCOUNT' | 'REWARD';
    benefit_value: any;
    conditions: any;
    expires_at: string;
    created_at: string;
}

interface Wallet {
    main: Coupon[];
    on_top: Coupon[];
}

export default function WalletPage() {
    const [userId, setUserId] = useState('');
    const [wallet, setWallet] = useState<Wallet>({ main: [], on_top: [] });
    const [loading, setLoading] = useState(false);
    const [collectDetails, setCollectDetails] = useState({ campaignId: '', secretCode: '' });
    const [collecting, setCollecting] = useState(false);
    const [sendingFlex, setSendingFlex] = useState(false);

    // Check URL for userId
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const uid = params.get('userId');
        if (uid) {
            setUserId(uid);
            fetchWallet(uid);
        }
    }, []);

    const fetchWallet = async (uid: string) => {
        if (!uid) return;
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-coupons?userId=${uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch wallet');
            const data = await res.json();
            setWallet(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCollect = async () => {
        if (!userId || !collectDetails.campaignId) {
            alert('User ID and Campaign ID are required');
            return;
        }

        setCollecting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/collect-coupon`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId,
                    campaignId: collectDetails.campaignId,
                    secretCode: collectDetails.secretCode || undefined
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to collect');

            // Optionally send Flex here if real app, but we have a dedicated button for testing flex.
            alert('Coupon Collected Successfully! 🎉');
            setCollectDetails({ campaignId: '', secretCode: '' });
            fetchWallet(userId);

        } catch (error: any) {
            alert(error.message);
        } finally {
            setCollecting(false);
        }
    };

    const handleTestFlex = async () => {
        if (!userId) return alert('Please enter User ID');
        setSendingFlex(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

            // Call test-flex function
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-flex`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId })
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Failed to send Flex');
            }
            alert('Flex Message Sent! Check your LINE.');
        } catch (e: any) {
            console.error(e);
            alert('Error: ' + e.message);
        } finally {
            setSendingFlex(false);
        }
    }

    const CouponCard = ({ coupon, type }: { coupon: Coupon, type: 'Main' | 'On-top' }) => {
        const isMain = type === 'Main';
        // Premium Styles
        const bgClass = isMain
            ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white'
            : 'bg-white border border-gray-100 text-gray-900';

        const borderClass = isMain ? 'border border-gray-700' : 'border border-gray-200';
        const iconColor = isMain ? 'text-yellow-400' : 'text-indigo-500';
        const badgeClass = isMain ? 'bg-yellow-500 text-black' : 'bg-indigo-100 text-indigo-700';

        return (
            <div className={`relative p-5 rounded-2xl shadow-lg ${bgClass} ${borderClass} overflow-hidden transition-all hover:scale-[1.02]`}>
                {/* Decorative Circles */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
                <div className="absolute top-10 -left-10 w-24 h-24 bg-current opacity-5 rounded-full blur-xl"></div>

                <div className="relative z-10 flex justify-between items-start">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider ${badgeClass}`}>
                                {type}
                            </span>
                            {coupon.benefit_type === 'DISCOUNT' && (
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                    Discount
                                </span>
                            )}
                        </div>
                        <h3 className="font-bold text-lg leading-tight mb-1">{coupon.name}</h3>
                        <p className={`text-sm ${isMain ? 'text-gray-400' : 'text-gray-500'}`}>
                            {coupon.benefit_type === 'DISCOUNT'
                                ? (coupon.benefit_value.amount ? `Save ฿${coupon.benefit_value.amount}` : `Save ${coupon.benefit_value.percent}%`)
                                : `Free ${coupon.benefit_value.item}`
                            }
                        </p>
                    </div>
                    <div className={`p-3 rounded-full ${isMain ? 'bg-white/10' : 'bg-indigo-50'}`}>
                        <Ticket className={`w-6 h-6 ${iconColor}`} />
                    </div>
                </div>

                <div className={`my-4 border-t border-dashed ${isMain ? 'border-gray-700' : 'border-gray-200'}`}></div>

                <div className="flex justify-between items-end">
                    <div className="text-xs opacity-60">
                        <p>Code: <span className="font-mono tracking-widest font-bold">{coupon.id.slice(0, 8)}...</span></p>
                        <p>Exp: {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : 'No Expiry'}</p>
                    </div>
                    <button className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${isMain ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}>
                        Use Now
                    </button>
                </div>
            </div>
        );
    };

    const [showSelectionModal, setShowSelectionModal] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 pb-20 font-sans">
            {/* Header */}
            <div className="bg-white pb-6 pt-8 px-6 shadow-sm rounded-b-[2rem] mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Wallet</h1>
                        <p className="text-gray-500 text-sm">Your premium rewards</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Gift className="w-5 h-5 text-gray-600" />
                    </div>
                </div>

                {/* User Input (Dev) */}
                <div className="flex gap-2 mt-4">
                    <input
                        value={userId}
                        onChange={e => setUserId(e.target.value)}
                        placeholder="Enter LINE User ID"
                        className="flex-1 bg-gray-100 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 outline-none"
                    />
                    <button
                        onClick={() => fetchWallet(userId)}
                        className="bg-gray-900 text-white px-5 rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
                    >
                        Load
                    </button>
                </div>
            </div>

            <div className="px-5 space-y-8">
                {/* Collect Section */}
                <section>
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h2 className="font-bold text-gray-900">Add Coupon</h2>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                        <input
                            className="w-full bg-gray-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Campaign ID (UUID)"
                            value={collectDetails.campaignId}
                            onChange={(e) => setCollectDetails({ ...collectDetails, campaignId: e.target.value })}
                        />
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <input
                                className="w-full bg-gray-50 border-0 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Secret Code (Optional)"
                                value={collectDetails.secretCode}
                                onChange={(e) => setCollectDetails({ ...collectDetails, secretCode: e.target.value })}
                            />
                        </div>
                        <button
                            onClick={handleCollect}
                            disabled={collecting}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                        >
                            {collecting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Collect Coupon'}
                        </button>
                    </div>
                </section>

                {/* Coupons List */}
                <section>
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h2 className="font-bold text-gray-900">Your Coupons</h2>
                        {wallet.main.length + wallet.on_top.length > 0 && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{wallet.main.length + wallet.on_top.length}</span>}
                    </div>

                    {loading ? (
                        <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300 mx-auto" /></div>
                    ) : (
                        <div className="space-y-4">
                            {wallet.main.map(c => <CouponCard key={c.id} coupon={c} type="Main" />)}
                            {wallet.on_top.map(c => <CouponCard key={c.id} coupon={c} type="On-top" />)}

                            {wallet.main.length === 0 && wallet.on_top.length === 0 && (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Ticket className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h3 className="text-gray-900 font-medium">No coupons yet</h3>
                                    <p className="text-gray-400 text-sm mt-1">Enter a campaign ID above to start.</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* Dev Tools */}
                <section className="pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 text-center">Developer Tools</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setShowSelectionModal(true)}
                            className="bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
                        >
                            Simulate Booking
                        </button>
                        <button
                            onClick={handleTestFlex}
                            disabled={sendingFlex}
                            className="bg-green-50 text-green-700 py-3 rounded-xl font-semibold text-sm hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                        >
                            {sendingFlex ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Test Flex Msg
                        </button>
                    </div>
                </section>
            </div>

            {/* Helper Modal */}
            <CouponSelectionModal
                isOpen={showSelectionModal}
                onClose={() => setShowSelectionModal(false)}
                userId={userId}
                totalPrice={1500}
                onConfirm={(ids, discount, final) => {
                    alert(`Booking Confirmed!\nUsed Coupon IDs: ${ids.join(', ')}\nDiscount: ${discount}\nFinal Price: ${final}`);
                    setShowSelectionModal(false);
                }}
            />
        </div>
    );
}
