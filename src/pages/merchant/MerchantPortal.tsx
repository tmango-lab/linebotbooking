import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/api';
import { LogIn, QrCode, Store, Loader2, Camera, CheckCircle2, XCircle, BarChart3, LogOut, Hash, RefreshCw, Keyboard, ScanLine, Gift, TrendingUp, Calendar, ShieldCheck } from 'lucide-react';

interface MerchantInfo {
    id: string;
    name: string;
}

// ============================================================
// Scan Result Popup (fullscreen overlay)
// ============================================================
function ScanResultPopup({ result, onClose }: { result: { success: boolean; message: string }; onClose: () => void }) {
    useEffect(() => {
        // Auto-close after 4 seconds for success, 5 for error
        const timer = setTimeout(onClose, result.success ? 4000 : 5000);
        return () => clearTimeout(timer);
    }, [result, onClose]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm" style={{ animation: 'popIn 0.3s ease-out' }}>
                {result.success ? (
                    <div className="bg-white rounded-3xl p-8 text-center shadow-2xl">
                        {/* Success animation ring */}
                        <div className="w-24 h-24 mx-auto mb-5 rounded-full flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                animation: 'pulse-ring 1s ease-out',
                                boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.4)',
                            }}>
                            <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">สแกนสำเร็จ!</h2>
                        <p className="text-gray-600 text-sm leading-relaxed mb-6">{result.message}</p>
                        <div className="bg-emerald-50 rounded-2xl px-4 py-3 flex items-center gap-2 justify-center">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-700">คูปองถูกตัดเรียบร้อยแล้ว</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-8 text-center shadow-2xl">
                        <div className="w-24 h-24 mx-auto mb-5 rounded-full flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                            <XCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">ไม่สำเร็จ</h2>
                        <p className="text-gray-600 text-sm leading-relaxed mb-6">{result.message}</p>
                        <button onClick={onClose}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm px-6 py-2.5 rounded-xl transition-colors">
                            ลองใหม่อีกครั้ง
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================
// Main Portal
// ============================================================
export default function MerchantPortal() {
    const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
    const [activeView, setActiveView] = useState<'scanner' | 'dashboard'>('scanner');

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
        <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, #fafbff 50%, #f5f3ff 100%)' }}>
            {/* Premium Top Bar */}
            <div className="sticky top-0 z-40" style={{ background: 'linear-gradient(135deg, #4338ca 0%, #6d28d9 50%, #7c3aed 100%)' }}>
                <div className="px-4 py-4 flex justify-between items-center max-w-lg mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Store className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm leading-tight">{merchant.name}</p>
                            <p className="text-white/60 text-[10px] font-medium">Merchant Portal</p>
                        </div>
                    </div>
                    <button onClick={handleLogout}
                        className="bg-transparent text-white/50 hover:text-white hover:bg-white/10 p-2.5 rounded-xl transition-all">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                {/* Tab Nav (pill style) */}
                <div className="px-4 pb-3 max-w-lg mx-auto">
                    <div className="flex bg-white/15 rounded-2xl p-1 backdrop-blur-sm">
                        <button onClick={() => setActiveView('scanner')}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                activeView === 'scanner'
                                    ? 'bg-white text-indigo-700 shadow-lg'
                                    : 'bg-transparent text-white/70 hover:text-white'
                            }`}>
                            <Camera className="w-3.5 h-3.5" />
                            สแกนคูปอง
                        </button>
                        <button onClick={() => setActiveView('dashboard')}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                activeView === 'dashboard'
                                    ? 'bg-white text-indigo-700 shadow-lg'
                                    : 'bg-transparent text-white/70 hover:text-white'
                            }`}>
                            <BarChart3 className="w-3.5 h-3.5" />
                            สรุปยอด
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 max-w-lg mx-auto pb-8">
                {activeView === 'scanner' && <ScannerView merchantId={merchant.id} />}
                {activeView === 'dashboard' && <DashboardView merchantId={merchant.id} />}
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes popIn { from { opacity: 0; transform: scale(0.85) } to { opacity: 1; transform: scale(1) } }
                @keyframes pulse-ring {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5) }
                    70% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0) }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0) }
                }
                @keyframes slideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
            `}</style>
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
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 30%, #7c3aed 60%, #a855f7 100%)' }}>
            {/* Decorative circles */}
            <div className="absolute top-20 left-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />

            <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
                style={{ animation: 'popIn 0.4s ease-out' }}>
                <div className="p-8 text-center">
                    {/* Logo */}
                    <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #4338ca, #7c3aed)' }}>
                        <Store className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mb-1">Merchant Portal</h1>
                    <p className="text-sm text-gray-400 mb-8">กรุณากรอกรหัส PIN เพื่อเข้าสู่ระบบ</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="relative">
                            <input
                                type="password"
                                value={pin}
                                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                                maxLength={6}
                                className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                placeholder="• • • •"
                                autoFocus
                                inputMode="numeric"
                            />
                            {/* PIN dots indicator */}
                            <div className="flex justify-center gap-2 mt-3">
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
                                        pin.length > i ? 'bg-indigo-600 scale-110' : 'bg-gray-200'
                                    }`} />
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 text-sm font-medium px-4 py-3 rounded-xl flex items-center gap-2">
                                <XCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading || pin.length < 4}
                            className="w-full py-4 text-white rounded-2xl font-bold text-lg disabled:opacity-40 transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                            style={{ background: 'linear-gradient(135deg, #4338ca, #7c3aed)' }}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                            เข้าสู่ระบบ
                        </button>
                    </form>
                </div>
            </div>
            <style>{`
                @keyframes popIn { from { opacity: 0; transform: scale(0.85) } to { opacity: 1; transform: scale(1) } }
            `}</style>
        </div>
    );
}

// ============================================================
// Scanner View — camera QR + manual token input
// ============================================================
function ScannerView({ merchantId }: { merchantId: string }) {
    const [mode, setMode] = useState<'camera' | 'manual'>('camera');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [cameraError, setCameraError] = useState('');
    const scannerRef = useRef<any>(null);
    const scannerContainerId = 'qr-scanner-container';
    const isProcessingRef = useRef(false);
    const [scanCount, setScanCount] = useState(0);

    const handleRedeem = useCallback(async (rawInput: string) => {
        if (!rawInput.trim() || isProcessingRef.current) return;
        isProcessingRef.current = true;
        setLoading(true);
        setResult(null);

        let actualToken = rawInput.trim();
        try {
            const parsed = JSON.parse(rawInput);
            if (parsed.token) actualToken = parsed.token;
        } catch { /* not JSON, use raw string */ }

        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(`${supabaseUrl}/functions/v1/use-merchant-coupon`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`,
                },
                body: JSON.stringify({ merchantId, redemptionToken: actualToken }),
            });

            const data = await response.json();

            if (data?.success) {
                setResult({ success: true, message: data.message || 'สแกนสำเร็จ! คูปองถูกใช้งานแล้ว' });
                setToken('');
                setScanCount(prev => prev + 1);
            } else {
                setResult({ success: false, message: data?.error || 'ไม่สามารถใช้คูปองได้' });
            }
        } catch (err: any) {
            setResult({ success: false, message: err.message || 'เกิดข้อผิดพลาด' });
        } finally {
            setLoading(false);
            setTimeout(() => { isProcessingRef.current = false; }, 3000);
        }
    }, [merchantId]);

    // Init/destroy camera scanner
    useEffect(() => {
        if (mode !== 'camera') return;

        let html5QrCode: any = null;

        const initScanner = async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                html5QrCode = new Html5Qrcode(scannerContainerId);
                scannerRef.current = html5QrCode;

                await html5QrCode.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1,
                    },
                    (decodedText: string) => {
                        handleRedeem(decodedText);
                    },
                    () => { /* ignore */ }
                );
                setCameraError('');
            } catch (err: any) {
                console.error('Camera error:', err);
                setCameraError(
                    err?.message?.includes('NotAllowed') || err?.toString?.()?.includes('NotAllowed')
                        ? 'กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์'
                        : 'ไม่สามารถเปิดกล้องได้ ลองใช้โหมดกรอกรหัสแทน'
                );
            }
        };

        const timer = setTimeout(initScanner, 300);

        return () => {
            clearTimeout(timer);
            if (html5QrCode) {
                const scanner = html5QrCode;
                if (scanner.isScanning) {
                    scanner.stop().then(() => {
                        scanner.clear();
                    }).catch(() => {
                        try { scanner.clear(); } catch { /* ignore */ }
                    });
                } else {
                    try { scanner.clear(); } catch { /* ignore */ }
                }
            }
            scannerRef.current = null;
        };
    }, [mode, handleRedeem]);

    return (
        <>
            <div className="space-y-4" style={{ animation: 'slideUp 0.3s ease-out' }}>
                {/* Mode Toggle (pill style) */}
                <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100">
                    <button
                        onClick={() => { setResult(null); setMode('camera'); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                            mode === 'camera'
                                ? 'text-white shadow-md'
                                : 'bg-transparent text-gray-400 hover:text-gray-600'
                        }`}
                        style={mode === 'camera' ? { background: 'linear-gradient(135deg, #4338ca, #7c3aed)' } : {}}
                    >
                        <ScanLine className="w-3.5 h-3.5" /> สแกน QR
                    </button>
                    <button
                        onClick={() => { setResult(null); setMode('manual'); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                            mode === 'manual'
                                ? 'text-white shadow-md'
                                : 'bg-transparent text-gray-400 hover:text-gray-600'
                        }`}
                        style={mode === 'manual' ? { background: 'linear-gradient(135deg, #4338ca, #7c3aed)' } : {}}
                    >
                        <Keyboard className="w-3.5 h-3.5" /> กรอกรหัส
                    </button>
                </div>

                {/* Session counter */}
                {scanCount > 0 && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Gift className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-700">สแกนรอบนี้</span>
                        </div>
                        <span className="text-lg font-black text-emerald-600">{scanCount}</span>
                    </div>
                )}

                {/* Camera Mode */}
                {mode === 'camera' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-5 text-center border-b border-gray-50">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #4338ca, #7c3aed)' }}>
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="font-bold text-gray-900 text-base">สแกน QR Code</h2>
                            <p className="text-xs text-gray-400 mt-1">ส่องกล้องไปที่ QR Code ของลูกค้า</p>
                        </div>

                        {cameraError ? (
                            <div className="px-5 py-8 text-center">
                                <div className="bg-red-50 border border-red-100 rounded-2xl p-5 mb-4">
                                    <XCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
                                    <p className="text-sm text-red-600 font-medium">{cameraError}</p>
                                </div>
                                <button onClick={() => setMode('manual')}
                                    className="text-indigo-600 text-sm font-bold hover:underline">
                                    ใช้โหมดกรอกรหัสแทน →
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <div id={scannerContainerId} style={{ width: '100%' }} />
                                {loading && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                        <div className="bg-white rounded-2xl px-8 py-5 flex flex-col items-center gap-3 shadow-xl">
                                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                            <span className="text-sm font-bold text-gray-700">กำลังตรวจสอบ...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Manual Mode */}
                {mode === 'manual' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #4338ca, #7c3aed)' }}>
                            <QrCode className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="font-bold text-gray-900 text-base mb-1">กรอกรหัสคูปอง</h2>
                        <p className="text-xs text-gray-400 mb-6">กรอกรหัส Token จากลูกค้า</p>

                        <div className="space-y-3">
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                                <input
                                    type="text"
                                    value={token}
                                    onChange={e => setToken(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-center font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                    placeholder="Redemption Token"
                                />
                            </div>
                            <button
                                onClick={() => handleRedeem(token)}
                                disabled={loading || !token.trim()}
                                className="w-full py-4 text-white rounded-2xl font-bold disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                ยืนยันการใช้คูปอง
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Fullscreen Result Popup */}
            {result && (
                <ScanResultPopup
                    result={result}
                    onClose={() => setResult(null)}
                />
            )}
        </>
    );
}

// ============================================================
// Dashboard View — daily/monthly stats
// ============================================================
function DashboardView({ merchantId }: { merchantId: string }) {
    const [stats, setStats] = useState<{ today: number; thisMonth: number; total: number }>({ today: 0, thisMonth: 0, total: 0 });
    const [recentScans, setRecentScans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDashboard(); }, []);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const { data: campaignIds } = await supabase
                .from('campaigns')
                .select('id')
                .eq('merchant_id', merchantId);

            if (!campaignIds || campaignIds.length === 0) {
                setLoading(false);
                return;
            }

            const ids = campaignIds.map(c => c.id);

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

                setStats({ today: todayCount, thisMonth: monthCount, total: usedCoupons.length });
                setRecentScans(usedCoupons.slice(0, 10));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <span className="text-xs text-gray-400 font-medium">กำลังโหลดข้อมูล...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4" style={{ animation: 'slideUp 0.3s ease-out' }}>
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                    <div className="w-8 h-8 mx-auto mb-2 rounded-xl flex items-center justify-center bg-blue-50">
                        <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-black text-gray-900">{stats.today}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-bold">วันนี้</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                    <div className="w-8 h-8 mx-auto mb-2 rounded-xl flex items-center justify-center bg-purple-50">
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-2xl font-black text-gray-900">{stats.thisMonth}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-bold">เดือนนี้</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                    <div className="w-8 h-8 mx-auto mb-2 rounded-xl flex items-center justify-center bg-emerald-50">
                        <Gift className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-black text-gray-900">{stats.total}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-bold">ทั้งหมด</p>
                </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 text-sm">🕘 สแกนล่าสุด</h3>
                    <button onClick={fetchDashboard}
                        className="bg-transparent text-indigo-500 hover:text-indigo-700 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                {recentScans.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                        {recentScans.map((scan, i) => (
                            <div key={i} className="px-5 py-3.5 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{(scan.campaigns as any)?.reward_item || (scan.campaigns as any)?.name || '-'}</p>
                                        <p className="text-[11px] text-gray-400">{scan.used_at ? new Date(scan.used_at).toLocaleString('th-TH') : '-'}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">สำเร็จ</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-10 text-center">
                        <Gift className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm font-medium">ยังไม่มีการสแกน</p>
                        <p className="text-gray-300 text-xs mt-1">เริ่มสแกนคูปองลูกค้าได้เลย!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
