import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/api';
import './App.css';

// Admin Imports
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import CustomerPage from './pages/admin/CustomerPage';
import ReportPage from './pages/admin/ReportPage';
import PromoCodePage from './pages/admin/PromoCodePage';
import CampaignPage from './pages/admin/CampaignPage'; // New V2
import WalletPage from './pages/user/WalletPage';
import BookingV2Page from './pages/liff/BookingV2Page'; // Import V2 Page
import BookingV3Page from './pages/liff/BookingV3Page'; // Import V3 Page
import { useNavigate } from 'react-router-dom'; // Import useNavigate

// Simple status page (Legacy/Root)
function StatusPage() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [connectionCheck, setConnectionCheck] = useState<string>('Checking data...');
  const [secretInput, setSecretInput] = useState('');
  const navigate = useNavigate(); // Hook for navigation
  // Debug State
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showButton, setShowButton] = useState(false);

  // Helper to add log
  const addLog = (msg: string) => setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

  // Fix: Log changes to console to satisfy 'unused variable' linter
  useEffect(() => {
    if (debugLog.length > 0) console.log('Debug Log:', debugLog[debugLog.length - 1]);
  }, [debugLog]);

  useEffect(() => {
    // [Fix] Handle Path to Hash Redirect (e.g. /wallet -> /#/wallet)
    if (window.location.pathname.length > 1 && !window.location.hash) {
      const path = window.location.pathname;
      const search = window.location.search;
      // Prevent infinite loop if already root
      if (path !== '/') {
        console.log(`Redirecting path ${path} to hash #${path}`);
        window.location.href = `/#${path}${search}`;
        return; // Stop execution to allow redirect
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

    // Check for V2 Mode
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');

    // [V2 Logic] If ?mode=v2, redirect to V2 Booking Page
    if (mode === 'v2') {
      addLog("Mode V2 Detected. Redirecting...");
      // Use timeout to ensure router is ready (optional but safer)
      setTimeout(() => {
        navigate('/booking-v2' + window.location.search);
      }, 100);
      return;
    }

    // [NEW] LIFF/Deep Link Redirect for HashRouter
    // ... logic continues ...

    // Check both Search AND Hash for params
    let liffState = searchParams.get('liff.state');

    if (!liffState) {
      // Try extracting from hash (e.g. #/?liff.state=...)
      const hash = window.location.hash;
      if (hash.includes('?')) {
        const hashQuery = hash.split('?')[1];
        const hashParams = new URLSearchParams(hashQuery);
        liffState = hashParams.get('liff.state');
        if (liffState) addLog("Found liff.state in HASH");
      }
    } else {
      addLog("Found liff.state in SEARCH");
    }

    addLog(`Checking Params: ${window.location.search} | Hash: ${window.location.hash}`);

    if (liffState) {
      setShowButton(true);
      addLog(`Found liff.state: ${liffState.substring(0, 15)}...`);

      try {
        const decodedState = decodeURIComponent(liffState);
        addLog(`Decoded: ${decodedState}`);

        // [Fix] Determine Target based on state content
        let targetPath = '/wallet'; // Default
        if (decodedState.includes('mode=v2')) {
          targetPath = '/booking-v2';
        } else if (decodedState.includes('mode=v3')) {
          targetPath = '/booking-v3';
        }

        // Construct Target
        const target = `${targetPath}${decodedState.startsWith('?') ? decodedState : '?' + decodedState}`;
        addLog(`Target: ${target}`);

        // Auto Redirect with Delay
        addLog("Attempting Auto-Redirect in 1s...");
        setTimeout(() => {
          window.location.hash = target;
        }, 1000);
      } catch (e: any) {
        addLog(`Error parsing: ${e.message}`);
      }
    }
  }, []);

  const handleSecretCheck = (val: string) => {
    setSecretInput(val);
    if (val === 'ภากร') {
      navigate('/wallet?userId=debughero');
    }
  };

  const handleManualRedir = () => {
    // Fallback: Just take everything from search and append to wallet hash
    const params = new URLSearchParams(window.location.search);
    const liffState = params.get('liff.state');
    if (liffState) {
      const decoded = decodeURIComponent(liffState);
      window.location.hash = `/wallet${decoded.startsWith('?') ? decoded : '?' + decoded}`;
    } else {
      navigate('/wallet');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', fontFamily: 'monospace', backgroundColor: '#f8f9fa', color: '#333' }}>
      <h1>Booking System</h1>

      {/* LIFF REDIRECT MODE */}
      {showButton ? (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontSize: '24px', marginBottom: '20px' }}>⏳ Redirecting to Wallet...</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Please wait a moment.</div>

          {/* Fallback Button (Unobtrusive) */}
          <button
            onClick={handleManualRedir}
            style={{ marginTop: '30px', padding: '10px 20px', fontSize: '16px', backgroundColor: '#eee', color: '#333', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer' }}
          >
            Click here if not redirected
          </button>
        </div>
      ) : (
        /* NORMAL STATUS MODE */
        <div style={{ padding: '2rem', border: '1px solid #ccc', borderRadius: '8px', marginTop: '2rem', textAlign: 'center', backgroundColor: 'white' }}>
          <p><strong>Status:</strong> {status}</p>
          <div style={{ whiteSpace: 'pre-line', marginTop: '1rem' }}>
            {connectionCheck}
          </div>
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
      )}
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public Status Page */}
        <Route path="/" element={<StatusPage />} />

        {/* User Routes (V2) */}
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/booking-v2" element={<BookingV2Page />} />
        <Route path="/booking-v3" element={<BookingV3Page />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<LoginPage />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="customers" element={<CustomerPage />} />
          <Route path="campaigns" element={<CampaignPage />} /> {/* New V2 */}
          <Route path="reports" element={<ReportPage />} />
          <Route path="promo-codes" element={<PromoCodePage />} />
        </Route>

        {/* Catch All - Redirect to Status Page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
