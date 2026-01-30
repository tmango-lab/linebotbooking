import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/api';
import './App.css';

// Admin Imports
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import PromoCodePage from './pages/admin/PromoCodePage';
import WalletPage from './pages/user/WalletPage';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

// Simple status page (Legacy/Root)
function StatusPage() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [connectionCheck, setConnectionCheck] = useState<string>('Checking data...');
  const [secretInput, setSecretInput] = useState('');
  const navigate = useNavigate(); // Hook for navigation

  useEffect(() => {
    if (supabase) {
      setStatus('Supabase Client Instantiated ✅');
    }

    const checkConnection = async () => {
      try {
        const { count: bookingsCount, error: bookingError } = await supabase.from('bookings').select('*', { count: 'exact', head: true });

        if (bookingError) {
          setConnectionCheck(`Error checking data: ${bookingError.message}`);
        } else {
          setConnectionCheck(`Data Verified 🚀\nBookings: ${bookingsCount}`);
          setStatus('Migration Complete ✅');
        }
      } catch (err: any) {
        setConnectionCheck('Connection Failed: ' + err.message);
      }
    };
    checkConnection();

    // [NEW] LIFF/Deep Link Redirect for HashRouter
    // Handle 'liff.state' which LIFF uses to pass params
    const params = new URLSearchParams(window.location.search);
    let action = params.get('action');
    let queryString = window.location.search;

    const liffState = params.get('liff.state');
    if (liffState) {
      // LIFF encodes the target path/params in liff.state
      // e.g. ?action=collect&code=...
      const decodedState = decodeURIComponent(liffState);
      // If it starts with ?, remove it for URLSearchParams, or just append
      console.log("LIFF State Decoded:", decodedState);

      // Extract params from the decoded state
      // It might be "/user/wallet?action=..." or just "?action=..." depending on what we passed
      // We passed: `/?action=collect...` so it's likely just `?action=collect...`

      // Let's parse it
      const stateParams = new URLSearchParams(decodedState.startsWith('?') ? decodedState : `?${decodedState}`);
      if (stateParams.get('action')) {
        action = stateParams.get('action');
        queryString = decodedState.startsWith('?') ? decodedState : `?${decodedState}`;
      }
    }

    if (action === 'collect') {
      // Navigate to wallet, preserving query params
      console.log("Redirecting to Wallet for Action:", action);
      navigate(`/wallet${queryString}`);
    }
  }, []);

  const handleSecretCheck = (val: string) => {
    setSecretInput(val);
    if (val === 'ภากร') {
      navigate('/wallet?userId=debughero');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <h1>Supabase Status</h1>
      <div style={{ padding: '2rem', border: '1px solid #ccc', borderRadius: '8px', marginTop: '2rem', textAlign: 'center' }}>
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

        {/* Admin Routes */}
        <Route path="/admin/login" element={<LoginPage />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="promo-codes" element={<PromoCodePage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
