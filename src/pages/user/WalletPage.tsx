import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/api';
import { useLiff } from '../../providers/LiffProvider';
import { Loader2, Ticket, Gift, Lock, Send } from 'lucide-react';
import CouponSelectionModal from '../../components/ui/CouponSelectionModal';

interface Coupon {
    coupon_id: string; // user_coupon_id (from API)
    campaign_id: string;
    name: string;
    description?: string | null;
    expiry: string; // API returns 'expiry' not 'expires_at'
    image?: string | null;
    benefit: {
        type: 'DISCOUNT' | 'REWARD';
        value: any;
    };
    conditions: any;
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
    const collectingRef = useRef(false);
    const [sendingFlex, setSendingFlex] = useState(false);


    // Check URL for userId and Auto-Collect Action
    const { isReady, liffUser } = useLiff();

    useEffect(() => {
        if (!isReady) return;

        const initUser = async () => {
            // [FIX] Support HashRouter params
            let params = new URLSearchParams(window.location.search);
            if (window.location.hash.includes('?')) {
                const hashQuery = window.location.hash.split('?')[1];
                const hashParams = new URLSearchParams(hashQuery);
                hashParams.forEach((val, key) => params.append(key, val));
            }

            let uid = params.get('userId');
            const action = params.get('action');
            const code = params.get('code') || '';
            const cid = params.get('id') || params.get('campaignId');

            // [NEW] Use ID from Provider if not in URL
            if (!uid && liffUser?.userId) {
                uid = liffUser.userId;
                console.log("Using LIFF User ID from Provider:", uid);
            }

            if (uid) {
                setUserId(uid);
                fetchWallet(uid);

                if (action === 'collect' && cid && !collectingRef.current) {
                    collectingRef.current = true;
                    console.log('Auto-collecting coupon...', { code, cid });
                    doAutoCollect(uid, cid, code);
                }
            } else {
                console.warn("Could not identify user via URL or LIFF Provider.");
            }
        };

        initUser();
    }, [isReady, liffUser]);

    const doAutoCollect = async (uid: string, cid: string, code: string) => {
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
                    userId: uid,
                    campaignId: cid,
                    secretCode: code
                })
            });

            const data = await res.json();

            if (!res.ok) {
                // [FIX] Silent ignore if already collected to avoid annoying alerts when viewing wallet
                if (data.error?.includes('already collected') || data.error?.includes('Limit reached')) {
                    console.log('Coupon already collected, skipping alert.');
                } else {
                    throw new Error(data.error || 'Failed to collect');
                }
            } else {
                // Success UI
                alert(`🎉 ยินดีด้วย! คุณเจอโค้ดลับ "${code}"\nเก็บคูปองเรียบร้อยแล้วครับ!`);
            }

            // [FIX] Better URL cleanup (Handles HashRouter e.g. /#/wallet?...)
            const hashValue = window.location.hash || '#/wallet';
            const cleanHash = hashValue.split('?')[0];
            const newUrl = `${window.location.pathname}${cleanHash}?userId=${uid}`;
            window.history.replaceState({}, '', newUrl);

            // Refresh Wallet
            fetchWallet(uid);

        } catch (error: any) {
            alert(`เสียใจด้วยครับ 😅\n${error.message}`);
        } finally {
            setCollecting(false);
        }
    };

    const [availableCampaigns, setAvailableCampaigns] = useState<any[]>([]);



    const fetchWallet = async (uid: string) => {
        if (!uid) return;
        setLoading(true);

        try {
            // Simplified: Use Anon Key directly. Edge function handles privilege.
            const token = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-coupons`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: uid })
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('API Error:', errText);
                throw new Error('Failed to fetch wallet');
            }

            const data = await res.json();
            setWallet(data);

            // 2. Fetch Available Public Campaigns (Client-side for now)
            // Note: This relies on 'campaigns' table being readable. If RLS blocks, we need a function.
            // We assume public read is allowed or we use the anon key.
            const { data: campaigns, error: campError } = await supabase
                .from('campaigns')
                .select('*')
                .eq('is_public', true)
                .eq('status', 'active')
                .gt('end_date', new Date().toISOString())
                .lte('start_date', new Date().toISOString());

            if (!campError && campaigns) {
                // Filter out ones I already have (optimistic check)
                // Real check happens at 'collect-coupon'
                const myCouponCampaignIds = [...data.main, ...data.on_top].map(c => c.campaign_id);
                const notCollected = campaigns.filter(c => !myCouponCampaignIds.includes(c.id));
                setAvailableCampaigns(notCollected);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCollect = async () => {
        if (!userId || !collectDetails.secretCode) {
            alert('กรุณากรอก User ID และ โค้ดลับ');
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
                    campaignId: '', // Allow empty for secret code lookup
                    secretCode: collectDetails.secretCode
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

    const handleUseCoupon = (coupon: Coupon) => {
        // Redirect to booking page with couponId
        // This allows user to proceed to the race test
        const target = `/booking-v3?userId=${userId}&couponId=${coupon.coupon_id}`;
        window.location.hash = `#${target}`;
    };

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
                            {coupon.benefit.type === 'DISCOUNT' && (
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                    Discount
                                </span>
                            )}
                        </div>
                        <h3 className="font-bold text-lg leading-tight mb-1">{coupon.name}</h3>
                        <p className={`text-sm ${isMain ? 'text-gray-400' : 'text-gray-500'}`}>
                            {coupon.benefit?.type === 'DISCOUNT'
                                ? (coupon.benefit?.value?.amount ? `Save ฿${coupon.benefit.value.amount}` : `Save ${coupon.benefit?.value?.percent ?? 0}%`)
                                : `Free ${coupon.benefit?.value?.item ?? 'Reward'}`
                            }
                        </p>
                    </div>
                    <div className={`p-3 rounded-full ${isMain ? 'bg-white/10' : 'bg-indigo-50'}`}>
                        <Ticket className={`w-6 h-6 ${iconColor}`} />
                    </div>
                </div>

                <div className={`my-4 border-t border-dashed ${isMain ? 'border-gray-700' : 'border-gray-200'}`}></div>

                {/* DEBUG INFO FOR MOBILE */}
                {import.meta.env.DEV && (
                    <div className="text-[10px] text-gray-400 break-all bg-black/5 p-2 rounded mt-2">
                        UID: {coupon.coupon_id}<br />
                        Camp: {coupon.campaign_id}
                    </div>
                )}

                <div className="flex justify-between items-end">
                    <div className="text-xs opacity-60">
                        <p>Code: <span className="font-mono tracking-widest font-bold">{coupon.coupon_id.slice(0, 8)}...</span></p>
                        <p>Exp: {coupon.expiry ? new Date(coupon.expiry).toLocaleDateString() : 'No Expiry'}</p>
                    </div>
                    <button
                        onClick={() => handleUseCoupon(coupon)}
                        className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${isMain ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}
                    >
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
                        <div className="bg-yellow-50 p-3 rounded-lg text-yellow-800 text-sm mb-2 text-center">
                            💡 กรอกโค้ดลับ (เช่น "ป้าขาว") เพื่อรับคูปอง
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <input
                                className="w-full bg-gray-50 border-0 rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="พิมพ์โค้ดลับที่นี่..."
                                value={collectDetails.secretCode}
                                onChange={(e) => setCollectDetails({ ...collectDetails, secretCode: e.target.value })}
                            />
                        </div>
                        <button
                            onClick={handleCollect}
                            disabled={collecting || !collectDetails.secretCode}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                        >
                            {collecting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'เก็บคูปอง'}
                        </button>
                    </div>
                </section>

                {/* Available Coupons (Public Marketplace) */}
                <section>
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h2 className="font-bold text-gray-900">🎁 คูปองแนะนำ (เก็บเลย!)</h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-300" /></div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {availableCampaigns.length === 0 ? (
                                <div className="text-center py-6 bg-white rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
                                    ไม่มีคูปองให้เก็บในขณะนี้
                                </div>
                            ) : (
                                availableCampaigns.map(camp => (
                                    <div key={camp.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider ${camp.is_stackable ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>
                                                    {camp.is_stackable ? 'On-Top' : 'Main'}
                                                </span>
                                                <span className="text-xs text-gray-500 font-medium">เหลือ {camp.remaining_quantity ?? 'ไม่อั้น'} สิทธิ์</span>
                                            </div>
                                            <h3 className="font-bold text-gray-900">{camp.name}</h3>
                                            <p className="text-sm text-gray-500 line-clamp-1">{camp.description}</p>
                                        </div>
                                        <button
                                            onClick={() => doAutoCollect(userId, camp.id, '')}
                                            disabled={collecting}
                                            className="ml-3 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200 whitespace-nowrap"
                                        >
                                            เก็บ
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </section>

                {/* Coupons List */}
                <section>
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h2 className="font-bold text-gray-900">กระเป๋าของฉัน</h2>
                        {wallet.main.length + wallet.on_top.length > 0 && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{wallet.main.length + wallet.on_top.length}</span>}
                    </div>

                    {loading ? (
                        <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300 mx-auto" /></div>
                    ) : (
                        <div className="space-y-4">
                            {wallet.main.map(c => <CouponCard key={c.coupon_id} coupon={c} type="Main" />)}
                            {wallet.on_top.map(c => <CouponCard key={c.coupon_id} coupon={c} type="On-top" />)}

                            {wallet.main.length === 0 && wallet.on_top.length === 0 && (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Ticket className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h3 className="text-gray-900 font-medium">ยังไม่มีคูปอง</h3>
                                    <p className="text-gray-400 text-sm mt-1">เก็บคูปองด้านบน หรือกรอกโค้ดลับเพื่อรับสิทธิ์</p>
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
