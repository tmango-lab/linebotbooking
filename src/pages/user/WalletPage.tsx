import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/api';
import { useLiff } from '../../providers/LiffProvider';
import { Loader2, Ticket, Gift, Lock } from 'lucide-react';

interface Coupon {
    coupon_id: string; // user_coupon_id
    campaign_id: string;
    name: string;
    description?: string | null;
    expiry: string;
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
            }

            if (uid) {
                setUserId(uid);
                fetchWallet(uid);

                if (action === 'collect' && cid && !collectingRef.current) {
                    collectingRef.current = true;
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
                if (data.error?.includes('already collected') || data.error?.includes('Limit reached')) {
                    console.log('Coupon already collected, skipping alert.');
                } else {
                    throw new Error(data.error || 'Failed to collect');
                }
            } else {
                alert(`🎉 ยินดีด้วย! คุณเจอโค้ดลับ "${code}"\nเก็บคูปองเรียบร้อยแล้วครับ!`);
            }

            // [FIX] Better URL cleanup
            const hashValue = window.location.hash || '#/wallet';
            const cleanHash = hashValue.split('?')[0];
            const newUrl = `${window.location.pathname}${cleanHash}?userId=${uid}`;
            window.history.replaceState({}, '', newUrl);

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
                throw new Error('Failed to fetch wallet');
            }

            const data = await res.json();
            setWallet(data);

            const { data: campaigns, error: campError } = await supabase
                .from('campaigns')
                .select('*')
                .eq('is_public', true)
                .eq('status', 'active')
                .gt('end_date', new Date().toISOString())
                .lte('start_date', new Date().toISOString());

            if (!campError && campaigns) {
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
                    campaignId: '',
                    secretCode: collectDetails.secretCode
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to collect');

            alert('Coupon Collected Successfully! 🎉');
            setCollectDetails({ campaignId: '', secretCode: '' });
            fetchWallet(userId);

        } catch (error: any) {
            alert(error.message);
        } finally {
            setCollecting(false);
        }
    };

    const handleUseCoupon = (coupon: Coupon) => {
        const target = `/booking-v3?userId=${userId}&couponId=${coupon.coupon_id}`;
        window.location.hash = `#${target}`;
    };

    const CouponCard = ({ coupon, type }: { coupon: Coupon, type: 'Main' | 'On-top' }) => {
        const isMain = type === 'Main';
        const bgClass = isMain
            ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white'
            : 'bg-white border border-gray-100 text-gray-900';

        const borderClass = isMain ? 'border border-gray-700' : 'border border-gray-200';
        const iconColor = isMain ? 'text-yellow-400' : 'text-indigo-500';
        const badgeClass = isMain ? 'bg-yellow-500 text-black' : 'bg-indigo-100 text-indigo-700';

        return (
            <div className={`relative p-5 rounded-2xl shadow-lg ${bgClass} ${borderClass} overflow-hidden transition-all hover:scale-[1.02]`}>
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
                {/* Clean user-facing header, no inputs */}
            </div>

            <div className="px-5 space-y-8">
                {/* Coupons List (Priority 1) */}
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

                {/* Available Coupons (Public Marketplace) - Moved up */}
                <section>
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h2 className="font-bold text-gray-900">🎁 คูปองแนะนำ</h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-300" /></div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {availableCampaigns.length > 0 && availableCampaigns.map(camp => (
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
                            ))}
                        </div>
                    )}
                </section>

                {/* Collect Section - Moved to bottom as secondary action */}
                <section>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Lock className="w-4 h-4 text-gray-400" />
                            <h2 className="font-bold text-gray-900 text-sm">กรอกโค้ดลับ</h2>
                        </div>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-gray-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="เช่น 'ป้าขาว'"
                                value={collectDetails.secretCode}
                                onChange={(e) => setCollectDetails({ ...collectDetails, secretCode: e.target.value })}
                            />
                            <button
                                onClick={handleCollect}
                                disabled={collecting || !collectDetails.secretCode}
                                className="bg-indigo-600 text-white px-5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 whitespace-nowrap"
                            >
                                {collecting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'รับ'}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
