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
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showButton, setShowButton] = useState(false);

  // Helper to add log
  const addLog = (msg: string) => setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

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
    addLog(`URL: ${window.location.href}`); // Log full URL

    // Check both Search AND Hash for params
    const searchParams = new URLSearchParams(window.location.search);
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

        // Construct Target
        const target = `/wallet${decodedState.startsWith('?') ? decodedState : '?' + decodedState}`;
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', fontFamily: 'monospace', backgroundColor: '#f8f9fa' }}>
      <h1>Supabase Status (Debug v3)</h1>

      {/* ALWAYS SHOW LOGS IF LIFF.STATE EXISTS */}
      {showButton && (
        <div style={{ width: '90%', maxWidth: '600px', margin: '20px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '10px', border: '2px solid #ffc107', color: '#000' }}>
          <h3 style={{ margin: 0 }}>⚠️ LIFF Redirect Mode</h3>
          <p>ระบบกำลังพยายามพาไปหน้า Wallet...</p>

          <button
            onClick={handleManualRedir}
            style={{ width: '100%', padding: '15px', fontSize: '18px', backgroundColor: '#06C755', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px', fontWeight: 'bold' }}
          >
            👉 คลิกที่นี่เพื่อไปหน้า Wallet
          </button>

          <div style={{ marginTop: '15px', background: '#333', color: '#0f0', padding: '10px', borderRadius: '5px', fontSize: '12px', textAlign: 'left', maxHeight: '150px', overflow: 'auto' }}>
            <div style={{ borderBottom: '1px solid #555', paddingBottom: '5px', marginBottom: '5px' }}>Debug Log:</div>
            {debugLog.map((log, i) => <div key={i}>{log}</div>)}
          </div>
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
