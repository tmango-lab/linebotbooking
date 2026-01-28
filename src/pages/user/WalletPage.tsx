import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { Loader2, Ticket, Gift, Lock, Search } from 'lucide-react';

interface Coupon {
    id: string; // user_coupon_id
    campaign_id: string;
    name: string;
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
            alert('Error fetching wallet');
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

            alert('Coupon Collected Successfully!');
            setCollectDetails({ campaignId: '', secretCode: '' });
            fetchWallet(userId);

        } catch (error: any) {
            alert(error.message);
        } finally {
            setCollecting(false);
        }
    };

    const CouponCard = ({ coupon, type }: { coupon: Coupon, type: 'Main' | 'On-top' }) => (
        <div className={`p-4 rounded-lg border ${type === 'Main' ? 'border-indigo-200 bg-indigo-50' : 'border-pink-200 bg-pink-50'} flex flex-col gap-2 relative overflow-hidden`}>
            <div className="flex justify-between items-start z-10">
                <div>
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${type === 'Main' ? 'bg-indigo-200 text-indigo-800' : 'bg-pink-200 text-pink-800'}`}>
                        {type}
                    </span>
                    <h3 className="font-bold text-gray-900 mt-1">{coupon.name}</h3>
                    <p className="text-sm text-gray-600">
                        {coupon.benefit_type === 'DISCOUNT'
                            ? (coupon.benefit_value.amount ? `฿${coupon.benefit_value.amount} off` : `${coupon.benefit_value.percent}% off`)
                            : `Free ${coupon.benefit_value.item}`
                        }
                    </p>
                </div>
                <Ticket className={`w-6 h-6 ${type === 'Main' ? 'text-indigo-400' : 'text-pink-400'}`} />
            </div>
            <div className="border-t border-dashed border-gray-300 my-1"></div>
            <div className="text-xs text-gray-500 flex justify-between">
                <span>Exp: {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : 'No Expiry'}</span>
            </div>
        </div>
    );

    const [showSelectionModal, setShowSelectionModal] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 p-4 pb-20">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Coupons</h1>
                <p className="text-gray-500 text-sm">Collect and manage your discounts</p>
            </header>

            {/* Debug / Login Section */}
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 space-y-3">
                <div className="flex gap-2">
                    <input
                        className="flex-1 p-2 border rounded text-sm"
                        placeholder="User ID (LINE UID)"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                    />
                    <button
                        onClick={() => fetchWallet(userId)}
                        className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                        Load
                    </button>
                </div>
            </div>

            {/* Collect Section */}
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 space-y-3">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-green-600" /> Collect Coupon
                </h2>
                <input
                    className="w-full p-2 border rounded text-sm"
                    placeholder="Campaign ID (UUID)"
                    value={collectDetails.campaignId}
                    onChange={(e) => setCollectDetails({ ...collectDetails, campaignId: e.target.value })}
                />
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        className="w-full p-2 pl-9 border rounded text-sm"
                        placeholder="Secret Code (Optional)"
                        value={collectDetails.secretCode}
                        onChange={(e) => setCollectDetails({ ...collectDetails, secretCode: e.target.value })}
                    />
                </div>
                <button
                    onClick={handleCollect}
                    disabled={collecting}
                    className="w-full bg-green-600 text-white py-2 rounded font-medium disabled:opacity-50"
                >
                    {collecting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Collect Now'}
                </button>
            </div>

            {/* Test Booking Section (V2 Integration) */}
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-indigo-100">
                <h2 className="font-semibold text-gray-800 mb-2">Simulate Booking (V2)</h2>
                <button
                    onClick={() => setShowSelectionModal(true)}
                    disabled={!userId}
                    className="w-full bg-indigo-600 text-white py-2 rounded font-medium disabled:opacity-50"
                >
                    Book with Coupons
                </button>
            </div>

            {/* Wallet List */}
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>
            ) : (
                <div className="space-y-6">
                    {wallet.main.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Main Coupons</h3>
                            <div className="space-y-3">
                                {wallet.main.map(c => <CouponCard key={c.id} coupon={c} type="Main" />)}
                            </div>
                        </div>
                    )}

                    {wallet.on_top.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">On-Top Coupons</h3>
                            <div className="space-y-3">
                                {wallet.on_top.map(c => <CouponCard key={c.id} coupon={c} type="On-top" />)}
                            </div>
                        </div>
                    )}

                    {wallet.main.length === 0 && wallet.on_top.length === 0 && userId && (
                        <div className="text-center py-10 text-gray-400">
                            <Ticket className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>No coupons found</p>
                        </div>
                    )}
                </div>
            )}

            {/* Helper Modal */}
            <CouponSelectionModal
                isOpen={showSelectionModal}
                onClose={() => setShowSelectionModal(false)}
                userId={userId}
                totalPrice={1500} // Mock price
                onConfirm={(ids, discount, final) => {
                    alert(`Booking Confirmed!\nUsed Coupon IDs: ${ids.join(', ')}\nDiscount: ${discount}\nFinal Price: ${final}`);
                    setShowSelectionModal(false);
                }}
            />
        </div>
    );
}
import CouponSelectionModal from '../../components/ui/CouponSelectionModal';
