import { useState, useEffect, Suspense } from 'react';
import { supabase } from '../../lib/api';
import { LogIn, QrCode, Store, Loader2, Camera, CheckCircle2, XCircle, BarChart3, LogOut, Hash, RefreshCw } from 'lucide-react';

interface MerchantInfo {
    id: string;
    name: string;
}

export default function MerchantPortal() {
    const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
    const [activeView, setActiveView] = useState<'scanner' | 'dashboard'>('scanner');

    // Check sessionStorage for existing login
    useEffect(() => {
        const stored = sessionStorage.getItem('merchant_session');
        if (stored) {
            try { setMerchant(JSON.parse(stored)); } catch { /* ignore */ }
        }
    }, []);

    const handleLogin = (m: MerchantInfo) => {
        setMerchant(m);
        sessionStorage.setItem('merchant_session', JSON.stringify(m));
    };

    const handleLogout = () => {
        setMerchant(null);
        sessionStorage.removeItem('merchant_session');
    };

    if (!merchant) {
        return <PinLoginPage onLogin={handleLogin} />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Bar */}
            <div className="bg-white border-b sticky top-0 z-40 px-4 py-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-indigo-600" />
                    <span className="font-bold text-gray-900">{merchant.name}</span>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            {/* Tab Nav */}
            <div className="flex bg-white border-b px-2">
                <button onClick={() => setActiveView('scanner')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeView === 'scanner' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'}`}>
                    <Camera className="w-4 h-4 inline mr-1.5" />
                    สแกนคูปอง
                </button>
                <button onClick={() => setActiveView('dashboard')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeView === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'}`}>
                    <BarChart3 className="w-4 h-4 inline mr-1.5" />
                    สรุปยอด
                </button>
            </div>

            {/* Content */}
            <div className="p-4 max-w-lg mx-auto">
                {activeView === 'scanner' && <ScannerView merchantId={merchant.id} />}
                {activeView === 'dashboard' && <DashboardView merchantId={merchant.id} />}
            </div>
        </div>
    );
}

// ============================================================
// PIN Login Page
// ============================================================
function PinLoginPage({ onLogin }: { onLogin: (m: MerchantInfo) => void }) {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length < 4) { setError('กรุณากรอก PIN อย่างน้อย 4 หลัก'); return; }

        setLoading(true);
        setError('');
        try {
            const { data, error: err } = await supabase
                .from('merchants')
                .select('id, name')
                .eq('pin_code', pin.trim())
                .eq('status', 'active')
                .single();

            if (err || !data) {
                setError('PIN ไม่ถูกต้อง หรือร้านค้าถูกปิดใช้งาน');
                return;
            }

            onLogin(data);
        } catch {
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Store className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-1">Merchant Portal</h1>
                    <p className="text-sm text-gray-500 mb-6">กรุณากรอกรหัส PIN เพื่อเข้าสู่ระบบ</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            type="password"
                            value={pin}
                            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                            maxLength={6}
                            className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            placeholder="• • • •"
                            autoFocus
                            inputMode="numeric"
                        />

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-2 rounded-lg">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading || pin.length < 4}
                            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                            เข้าสู่ระบบ
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Scanner View — manual token input
// ============================================================
function ScannerView({ merchantId }: { merchantId: string }) {
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleRedeem = async () => {
        if (!token.trim()) return;
        setLoading(true);
        setResult(null);

        try {
            // Call Edge Function for redemption
            const { data, error } = await supabase.functions.invoke('use-merchant-coupon', {
                body: { merchantId, redemptionToken: token.trim() }
            });

            if (error) throw error;

            if (data?.success) {
                setResult({ success: true, message: data.message || 'สแกนสำเร็จ! คูปองถูกใช้งานแล้ว ✅' });
                setToken('');
            } else {
                setResult({ success: false, message: data?.error || 'ไม่สามารถใช้คูปองได้' });
            }
        } catch (err: any) {
            setResult({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="font-bold text-gray-900 text-lg mb-2">สแกนคูปองลูกค้า</h2>
                <p className="text-sm text-gray-500 mb-6">กรอกรหัสคูปองจาก QR Code ของลูกค้า</p>

                {/* Manual Input */}
                <div className="space-y-3">
                    <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl text-center font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            placeholder="กรอก Redemption Token"
                        />
                    </div>
                    <button
                        onClick={handleRedeem}
                        disabled={loading || !token.trim()}
                        className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                        ยืนยันการใช้คูปอง
                    </button>
                </div>
            </div>

            {/* Result */}
            {result && (
                <div className={`rounded-2xl p-5 text-center ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    {result.success ? (
                        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    ) : (
                        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                    )}
                    <p className={`font-bold ${result.success ? 'text-green-700' : 'text-red-700'}`}>{result.message}</p>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Dashboard View — daily/monthly stats
// ============================================================
function DashboardView({ merchantId }: { merchantId: string }) {
    const [stats, setStats] = useState<{ today: number; thisMonth: number }>({ today: 0, thisMonth: 0 });
    const [recentScans, setRecentScans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDashboard(); }, []);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            // Get campaigns for this merchant
            const { data: campaignIds } = await supabase
                .from('campaigns')
                .select('id')
                .eq('merchant_id', merchantId);

            if (!campaignIds || campaignIds.length === 0) {
                setLoading(false);
                return;
            }

            const ids = campaignIds.map(c => c.id);

            // Get used coupons for these campaigns
            const { data: usedCoupons } = await supabase
                .from('user_coupons')
                .select('id, used_at, campaigns(name, reward_item)')
                .in('campaign_id', ids)
                .eq('status', 'USED')
                .order('used_at', { ascending: false })
                .limit(50);

            if (usedCoupons) {
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                const monthStr = now.toISOString().slice(0, 7);

                const todayCount = usedCoupons.filter(uc => uc.used_at && uc.used_at.startsWith(todayStr)).length;
                const monthCount = usedCoupons.filter(uc => uc.used_at && uc.used_at.startsWith(monthStr)).length;

                setStats({ today: todayCount, thisMonth: monthCount });
                setRecentScans(usedCoupons.slice(0, 10));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>;
    }

    return (
        <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border text-center">
                    <p className="text-3xl font-black text-indigo-600">{stats.today}</p>
                    <p className="text-sm text-gray-500 mt-1 font-medium">สแกนวันนี้</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border text-center">
                    <p className="text-3xl font-black text-purple-600">{stats.thisMonth}</p>
                    <p className="text-sm text-gray-500 mt-1 font-medium">สแกนเดือนนี้</p>
                </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-white rounded-2xl shadow-sm border">
                <div className="px-5 py-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">สแกนล่าสุด</h3>
                    <button onClick={fetchDashboard} className="text-indigo-600 p-1">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                {recentScans.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                        {recentScans.map((scan, i) => (
                            <div key={i} className="px-5 py-3 flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{(scan.campaigns as any)?.reward_item || (scan.campaigns as any)?.name || '-'}</p>
                                    <p className="text-xs text-gray-400">{scan.used_at ? new Date(scan.used_at).toLocaleString('th-TH') : '-'}</p>
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">ยังไม่มีการสแกน</div>
                )}
            </div>
        </div>
    );
}
