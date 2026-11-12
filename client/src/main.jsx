import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import AuthPage from './pages/Auth.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Voice from './pages/Voice.jsx';
import Inventory from './pages/Inventory.jsx';
import Transactions from './pages/Transactions.jsx';
import Khata from './pages/Khata.jsx';
import Settings from './pages/Settings.jsx';

const Reports = lazy(() => import('./pages/Reports.jsx')); // recharts-heavy

function Private({ children, needBusiness = true }) {
  const { loading, user, business } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (needBusiness && !business) return <Navigate to="/onboarding" replace />;
  return children;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/onboarding" element={<Private needBusiness={false}><Onboarding /></Private>} />
          <Route path="/app" element={<Private><Layout /></Private>}>
            <Route index element={<Dashboard />} />
            <Route path="voice" element={<Voice />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="khata" element={<Khata />} />
            <Route path="khata/:id" element={<Khata />} />
            <Route path="reports" element={<Suspense fallback={<Spinner />}><Reports /></Suspense>} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
