import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { supabase } from './lib/api';
import './App.css';
import { LiffProvider, useLiff } from './providers/LiffProvider';

// [OPTIMIZED] Static Imports for Customer Pages (Faster)
import WalletPage from './pages/user/WalletPage';
import BookingV2Page from './pages/liff/BookingV2Page';
import BookingV3Page from './pages/liff/BookingV3Page';
import BookingSuccessPage from './pages/liff/BookingSuccessPage';
import AffiliateRegisterPage from './pages/user/AffiliateRegisterPage';
import AffiliateDashboardPage from './pages/user/AffiliateDashboardPage';

// Lazy Load Admin Components ONLY (To keep client bundle small)
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const LoginPage = lazy(() => import('./pages/admin/LoginPage'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const CustomerPage = lazy(() => import('./pages/admin/CustomerPage'));
const CustomerDetailPage = lazy(() => import('./pages/admin/CustomerDetailPage'));
const ReportPage = lazy(() => import('./pages/admin/ReportPage'));
const PromoCodePage = lazy(() => import('./pages/admin/PromoCodePage'));
const CampaignPage = lazy(() => import('./pages/admin/CampaignPage'));
const RefundPage = lazy(() => import('./pages/admin/RefundPage'));
const BookingSearchPage = lazy(() => import('./pages/admin/BookingSearchPage'));
const ReferralSettingsPage = lazy(() => import('./pages/admin/ReferralSettingsPage'));
const SystemSettingsPage = lazy(() => import('./pages/admin/SystemSettingsPage'));

// Branded Loader
const PageLoader = ({ text = "Loading..." }) => (
  <div className="h-screen flex items-center justify-center flex-col bg-gray-50">
    <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
    <div className="mt-6 text-center">
      <h3 className="text-lg font-bold text-gray-800">Booking System</h3>
      <p className="text-sm text-gray-500 mt-1">{text}</p>
    </div>
  </div>
);

// Simple status page (Legacy/Root)
function StatusPage() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [connectionCheck, setConnectionCheck] = useState<string>('Checking data...');
  const [secretInput, setSecretInput] = useState('');
  const navigate = useNavigate();

  // Use Provider
  const { isReady, liffUser, error } = useLiff();

  useEffect(() => {
    if (supabase) {
      setStatus('Supabase Client Instantiated ✅');
    }

    const checkConnection = async () => {
      try {
        const { count: bookingsCount, error: bookingError } = await supabase.from('bookings').select('*', { count: 'exact', head: true });

        if (bookingError) {
          // Ignore 401 Unauthorized (likely anonymous user/wallet user)
          if (bookingError.code === '401' || bookingError.message.includes('401')) {
            setConnectionCheck('Connected (Anonymous Access) 🟢');
            setStatus('Ready (Public Mode) ✅');
          } else {
            setConnectionCheck(`Error checking data: ${bookingError.message}`);
          }
        } else {
          setConnectionCheck(`Data Verified 🚀\nBookings: ${bookingsCount}`);
          setStatus('Migration Complete ✅');
        }
      } catch (err: any) {
        setConnectionCheck('Connection Failed: ' + err.message);
      }
    };
    checkConnection();

  }, []);

  const handleSecretCheck = (val: string) => {
    setSecretInput(val);
    if (val === 'ภากร') {
      navigate('/wallet?userId=debughero');
    }
  };


  // Global Loading State for LIFF
  if (!isReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <div className="loader"></div>
        <p style={{ marginTop: '20px', color: '#666' }}>Initializing LINE...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', fontFamily: 'monospace', backgroundColor: '#f8f9fa', color: '#333' }}>
      <h1>Booking System</h1>

      <div style={{ padding: '2rem', border: '1px solid #ccc', borderRadius: '8px', marginTop: '2rem', textAlign: 'center', backgroundColor: 'white' }}>
        <p><strong>Status:</strong> {status}</p>
        <div style={{ whiteSpace: 'pre-line', marginTop: '1rem' }}>
          {connectionCheck}
        </div>

        {liffUser?.userId && <p style={{ color: 'green', marginTop: '10px' }}>LIFF User: {liffUser.displayName || 'Identified'}</p>}
        {error && <p style={{ color: 'red', marginTop: '10px' }}>LIFF Error: {error}</p>}

        <div style={{ marginTop: '2rem' }}>
          <a href="#/admin/dashboard" className="status-link">Go to Admin Dashboard &rarr;</a>
        </div>

        {/* Secret Trigger Area */}
        <div style={{ marginTop: '3rem', opacity: 0.1, }}>
          <input
            value={secretInput}
            onChange={(e) => handleSecretCheck(e.target.value)}
            placeholder="..."
            style={{ border: 'none', background: 'transparent', textAlign: 'center', outline: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}

// Smart Redirect Component
function RootRedirect() {
  const searchParams = new URLSearchParams(window.location.search);
  const redirect = searchParams.get('redirect');

  const liffState = searchParams.get('liff.state');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // [NEW] Check App Mode from Environment
  const appMode = import.meta.env.VITE_APP_MODE; // 'admin', 'booking', 'wallet'
  const searchStr = window.location.search; // Preserve all params (ref, userId, etc.)

  const { isReady } = useLiff();

  if ((liffState || code || state) && !isReady) {
    return <PageLoader text="Verifying Secure Login..." />;
  }

  // 1. Priority: Explicit Redirect Param (Deep Links)
  if (redirect === 'wallet') {
    return <Navigate to={`/wallet${searchStr}`} replace />;
  }
  if (redirect === 'booking-v2') {
    return <Navigate to={`/booking-v2${searchStr}`} replace />;
  }
  if (redirect === 'booking-v3') {
    return <Navigate to={`/booking-v3${searchStr}`} replace />;
  }
  if (redirect === 'affiliate-dashboard') {
    return <Navigate to={`/affiliate-dashboard${searchStr}`} replace />;
  }
  if (redirect === 'affiliate-register') {
    return <Navigate to={`/affiliate-register${searchStr}`} replace />;
  }

  // 2. Secondary Priority: App Mode Default
  if (appMode === 'booking') {
    return <Navigate to={`/booking-v2${searchStr}`} replace />;
  }
  if (appMode === 'wallet') {
    return <Navigate to={`/wallet${searchStr}`} replace />;
  }

  // 3. Default: Admin Dashboard
  return <Navigate to="/admin" replace />;
}

function App() {
  return (
    <LiffProvider>
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Smart Redirect for Root */}
            <Route path="/" element={<RootRedirect />} />

            {/* Status Page for Debugging */}
            <Route path="/status" element={<StatusPage />} />

            {/* User Routes (V2) */}
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/booking-v2" element={<BookingV2Page />} />
            <Route path="/booking-v3" element={<BookingV3Page />} />
            <Route path="/booking-success" element={<BookingSuccessPage />} />
            <Route path="/affiliate-register" element={<AffiliateRegisterPage />} />
            <Route path="/affiliate-dashboard" element={<AffiliateDashboardPage />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<LoginPage />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="booking-search" element={<BookingSearchPage />} />
              <Route path="customers" element={<CustomerPage />} />
              <Route path="customers/:id" element={<CustomerDetailPage />} />
              <Route path="campaigns" element={<CampaignPage />} />
              <Route path="reports" element={<ReportPage />} />
              <Route path="promo-codes" element={<PromoCodePage />} />
              <Route path="refunds" element={<RefundPage />} />
              <Route path="referral-settings" element={<ReferralSettingsPage />} />
              <Route path="system-settings" element={<SystemSettingsPage />} />
            </Route>

            {/* Catch All - Redirect to Status Page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </LiffProvider>
  );
}

export default App;
