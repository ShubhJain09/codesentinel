import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Suspense, lazy } from 'react';

// Eagerly loaded public & layout components
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AppLayout from './components/AppLayout';
import LoadingScreen from './components/LoadingScreen';

// Core authenticated pages eagerly loaded to eliminate chunk suspension & flicker
import CommandCenter from './pages/CommandCenter';
import FindingsPage from './pages/FindingsPage';
import ScanHistoryPage from './pages/ScanHistoryPage';
import ScanDetailPage from './pages/ScanDetailPage';
import RepositoriesPage from './pages/RepositoriesPage';
import PipelinePage from './pages/PipelinePage';
import IntegrationsPage from './pages/IntegrationsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import AdminControlCenter from './pages/AdminControlCenter';
import MyProfilePage from './pages/MyProfilePage';

// Lazy loaded auxiliary pages
const DocsPage = lazy(() => import('./pages/DocsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ThankYouPage = lazy(() => import('./pages/ThankYouPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/thank-you" element={<ThankYouPage />} />

            {/* Protected app routes */}
            <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route index element={<CommandCenter />} />
              <Route path="findings" element={<FindingsPage />} />
              <Route path="scans" element={<ScanHistoryPage />} />
              <Route path="scans/:id" element={<ScanDetailPage />} />
              <Route path="repositories" element={<RepositoriesPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<MyProfilePage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="admin/control-center" element={<AdminControlCenter />} />
            </Route>

            {/* 404 & Catch-all */}
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
