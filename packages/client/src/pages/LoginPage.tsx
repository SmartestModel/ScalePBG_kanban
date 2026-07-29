import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { Chrome, Mail, Lock, User, Layers } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(cred.user, { displayName });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // onAuthStateChanged in App.tsx handles the rest
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setError(getFirebaseErrorMessage(e.code ?? ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Animated background blobs */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '10%',
            left: '15%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, hsla(217,91%,60%,0.06) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'pulse-dot 8s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '15%',
            right: '10%',
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(circle, hsla(258,84%,66%,0.06) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'pulse-dot 10s ease-in-out infinite reverse',
          }}
        />
      </div>

      <div className="auth-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: 'linear-gradient(135deg, var(--brand-primary), var(--accent-violet))',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Layers size={26} color="white" />
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              fontFamily: 'Outfit, sans-serif',
              marginBottom: 6,
            }}
            className="gradient-text"
          >
            KanbanFlow
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {mode === 'login'
              ? 'Sign in to your workspace'
              : 'Create your account'}
          </p>
        </div>

        {/* Google button */}
        <button
          id="google-signin-btn"
          className="btn btn-secondary w-full"
          style={{ marginBottom: 20, justifyContent: 'center', height: 42 }}
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <Chrome size={16} />
          Continue with Google
        </button>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div className="divider" style={{ flex: 1, margin: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            or with email
          </span>
          <div className="divider" style={{ flex: 1, margin: 0 }} />
        </div>

        {/* Error */}
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Form */}
        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <div className="input-group">
              <label className="input-label" htmlFor="display-name">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="display-name"
                  className="input"
                  type="text"
                  placeholder="Jane Smith"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="email-input">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                id="email-input"
                className="input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password-input">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                id="password-input"
                className="input"
                type="password"
                placeholder={mode === 'register' ? 'Min. 6 characters' : 'Your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            className="btn btn-primary w-full btn-lg"
            disabled={isLoading}
            style={{ marginTop: 4 }}
          >
            {isLoading ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading...</>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            id="auth-toggle-mode"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

function getFirebaseErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'auth/user-not-found':     'No account found with this email.',
    'auth/wrong-password':     'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':      'Password must be at least 6 characters.',
    'auth/invalid-email':      'Please enter a valid email address.',
    'auth/too-many-requests':  'Too many failed attempts. Please try again later.',
    'auth/invalid-credential': 'Invalid credentials. Check your email and password.',
  };
  return messages[code] ?? 'Authentication failed. Please try again.';
}
