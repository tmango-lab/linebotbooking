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
  // Debug State
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [manualLink, setManualLink] = useState<string | null>(null);

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
    let debugLog = `Raw Params: ${window.location.search}\n`;

    const liffState = params.get('liff.state');
    if (liffState) {
      debugLog += `Found liff.state: ${liffState.substring(0, 20)}...\n`;
      // LIFF encodes the target path/params in liff.state
      const decodedState = decodeURIComponent(liffState);
      debugLog += `Decoded: ${decodedState}\n`;

      const stateParams = new URLSearchParams(decodedState.startsWith('?') ? decodedState : `?${decodedState}`);
      if (stateParams.get('action')) {
        action = stateParams.get('action');
        // We want to pass the INNER params to the wallet, not the outer liff.state wrapper
        queryString = decodedState.startsWith('?') ? decodedState : `?${decodedState}`;
        debugLog += `Extracted Action: ${action}\n`;
      }
    }

    setDebugInfo(debugLog);

    if (action === 'collect') {
      const targetHash = `/wallet${queryString}`;
      debugLog += `Target: ${targetHash}\n`;
      setDebugInfo(debugLog);
      setManualLink(targetHash);

      console.log("Redirecting to Wallet for Action:", action);

      // Attempt Auto-Redirect
      setTimeout(() => {
        // Try explicit hash set first (more robust for HashRouter init)
        window.location.hash = targetHash;
        // Fallback to navigate if needed (though hash set usually triggers router)
        // navigate(targetHash); 
      }, 500); // Small delay to let React render
    }
  }, []);

  const handleSecretCheck = (val: string) => {
    setSecretInput(val);
    if (val === 'ภากร') {
      navigate('/wallet?userId=debughero');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <h1>Supabase Status</h1>

      {/* MANUAL REDIRECT BUTTON (If Auto fails) */}
      {manualLink && (
        <div style={{ margin: '20px', padding: '20px', backgroundColor: '#e6ffe6', borderRadius: '10px', border: '2px solid #00cc00' }}>
          <h3>🚀 พบข้อมูลคูปอง!</h3>
          <p>ระบบกำลังพาท่านไปหน้า Wallet...</p>
          <p>(ถ้าไม่เด้งอัตโนมัติ ให้กดปุ่มด้านล่าง)</p>
          <button
            onClick={() => window.location.hash = manualLink}
            style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#06C755', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', marginTop: '10px' }}
          >
            👉 ไปเก็บคูปอง
          </button>
          <details style={{ marginTop: '15px', color: '#666' }}>
            <summary>Debug Info</summary>
            <pre style={{ fontSize: '10px', textAlign: 'left', overflow: 'auto' }}>{debugInfo}</pre>
          </details>
        </div>
      )}

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
