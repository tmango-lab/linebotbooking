import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/api';
import './App.css';
import { LiffProvider, useLiff } from './providers/LiffProvider'; // [NEW]

// Admin Imports
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import CustomerPage from './pages/admin/CustomerPage';
import ReportPage from './pages/admin/ReportPage';
import PromoCodePage from './pages/admin/PromoCodePage';
import CampaignPage from './pages/admin/CampaignPage'; // New V2
import RefundPage from './pages/admin/RefundPage'; // New Refund UI
import WalletPage from './pages/user/WalletPage';
import BookingV2Page from './pages/liff/BookingV2Page'; // Import V2 Page
import BookingV3Page from './pages/liff/BookingV3Page'; // Import V3 Page
import BookingSuccessPage from './pages/liff/BookingSuccessPage';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

// Simple status page (Legacy/Root)
function StatusPage() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [connectionCheck, setConnectionCheck] = useState<string>('Checking data...');
  const [secretInput, setSecretInput] = useState('');
  const navigate = useNavigate(); // Hook for navigation

  // [NEW] Use Provider
  const { isReady, liffUser, error } = useLiff();

  useEffect(() => {
    // [Fix] Handle Path to Hash Redirect (e.g. /wallet -> /#/wallet)
    // ONLY do this if we are not already in a HashRouter valid state
    // AND if we are not in a refresh loop.
    if (window.location.pathname.length > 1 && !window.location.hash) {
      // This logic is dangerous if not handled via server rewrite rules
      // But assuming Vercel rewrites all to index.html, this is client-side path fix.
      const path = window.location.pathname;
      if (path !== '/' && !path.startsWith('/admin')) {
        // Admin paths might be handled differently, but generally same rule.
        console.log(`Redirecting path ${path} to hash #${path}`);
        window.location.href = `/#${path}${window.location.search}`;
        return;
      }
    }

    if (supabase) {
      setStatus('Supabase Client Instantiated ✅');
    }

    const checkConnection = async () => {
      try {
        const { count: bookingsCount, error: bookingError } = await supabase.from('bookings').select('*', { count: 'exact', head: true });

        if (bookingError) {
          // [Fix] Ignore 401 Unauthorized (likely anonymous user/wallet user)
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

  // [Fix] Early Return if Redirecting (Prevents Flash)
  if (window.location.pathname.length > 1 && window.location.pathname !== '/') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <div className="loader"></div>
        <p style={{ marginTop: '20px', color: '#666' }}>Redirecting to {window.location.pathname}...</p>
      </div>
    );
  }

  // [NEW] Global Loading State for LIFF
  if (!isReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <div className="loader"></div>
        <p style={{ marginTop: '20px', color: '#666' }}>Initializing LINE...</p>
      </div>
    );
  }

  // If LIFF Initialized and User Found, we might want to auto-redirect from root?
  // For now, keep Status Page as landing for debugging or root access.

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

function App() {
  return (
    <LiffProvider>
      <HashRouter>
        <Routes>
          {/* Public Status Page */}
          <Route path="/" element={<StatusPage />} />

          {/* User Routes (V2) */}
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/booking-v2" element={<BookingV2Page />} />
          <Route path="/booking-v3" element={<BookingV3Page />} />
          <Route path="/booking-success" element={<BookingSuccessPage />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<LoginPage />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="customers" element={<CustomerPage />} />
            <Route path="campaigns" element={<CampaignPage />} /> {/* New V2 */}
            <Route path="reports" element={<ReportPage />} />
            <Route path="promo-codes" element={<PromoCodePage />} />
            <Route path="refunds" element={<RefundPage />} />
          </Route>

          {/* Catch All - Redirect to Status Page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </LiffProvider>
  );
}

export default App;
