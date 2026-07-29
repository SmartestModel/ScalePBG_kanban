import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { auth } from './firebase/config';
import { useAuthStore } from './store/useAuthStore';
import { syncProfile } from './services/api';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { BoardPage } from './pages/BoardPage';
import { BacklogPage } from './pages/BacklogPage';
import { SprintPage } from './pages/SprintPage';
import { Sidebar } from './components/Sidebar';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// ── Protected App Shell ───────────────────────────────────────────────────────

const AppShell: React.FC = () => (
  <div className="app-layout">
    <Sidebar />
    <main className="main-content">
      <Routes>
        <Route path="/app"     element={<BoardPage />} />
        <Route path="/backlog" element={<BacklogPage />} />
        <Route path="/sprints" element={<SprintPage />} />
        <Route path="*"        element={<Navigate to="/app" replace />} />
      </Routes>
    </main>
  </div>
);

// ── Root Auth Router ──────────────────────────────────────────────────────────

const AuthRouter: React.FC = () => {
  const {
    firebaseUser, user, orgs, activeOrgId,
    setFirebaseUser, setProfile, setActiveOrg, setLoading, reset,
  } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        reset();
        return;
      }

      setFirebaseUser({ uid: fbUser.uid, email: fbUser.email });

      try {
        // Sync profile to Firestore + get org memberships
        const res = await syncProfile();
        if (res.success && res.data) {
          setProfile(res.data.user, res.data.orgs);

          // If user has orgs, set first one as active
          if (res.data.orgs.length > 0 && !activeOrgId) {
            const firstOrg = res.data.orgs[0];
            // We need to find user's role in org — we'll use a simple call
            setActiveOrg(firstOrg.id, 'member'); // temp role, sidebar will refresh
          }
        }
      } catch {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  if (useAuthStore.getState().isLoading && !firebaseUser) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
        }}
      >
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  // Not logged in
  if (!firebaseUser) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Logged in but no org
  if (!activeOrgId || orgs.length === 0) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  // Logged in + has org
  return <AppShell />;
};

// ── App ───────────────────────────────────────────────────────────────────────

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthRouter />
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
