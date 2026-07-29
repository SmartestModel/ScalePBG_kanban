import React, { useState } from 'react';
import { createOrg, searchOrgBySlug, createAccessRequest } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { Organization } from '../types';
import { Building2, Search, Plus, ArrowRight, Clock } from 'lucide-react';

type Step = 'choice' | 'create' | 'request' | 'pending';

export const OnboardingPage: React.FC = () => {
  const [step, setStep] = useState<Step>('choice');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [searchSlug, setSearchSlug] = useState('');
  const [foundOrg, setFoundOrg] = useState<Pick<Organization, 'id' | 'name' | 'slug'> | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);

  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);
  const setProfile = useAuthStore((s) => s.setProfile);
  const user = useAuthStore((s) => s.user);
  const orgs = useAuthStore((s) => s.orgs);

  const slugify = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOrgName(e.target.value);
    setOrgSlug(slugify(e.target.value));
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !orgSlug.trim()) return;
    setError('');
    setIsLoading(true);
    try {
      const res = await createOrg({ name: orgName.trim(), slug: orgSlug.trim() });
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to create organization.');
        return;
      }
      const newOrg = res.data!;
      setProfile(user!, [...orgs, newOrg]);
      setActiveOrg(newOrg.id, 'admin');
    } catch {
      setError('Failed to create organization. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFoundOrg(null);
    setIsLoading(true);
    try {
      const res = await searchOrgBySlug(searchSlug.trim());
      if (!res.success || !res.data) {
        setError('Organization not found. Double-check the slug.');
        return;
      }
      setFoundOrg(res.data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!foundOrg) return;
    setIsLoading(true);
    try {
      const res = await createAccessRequest(foundOrg.id);
      if (res.success) {
        setPendingRequest(true);
        setStep('pending');
      } else {
        setError(res.error?.message ?? 'Failed to send request.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'pending') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: 'hsla(38,92%,50%,0.15)',
              border: '1px solid hsla(38,92%,50%,0.3)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <Clock size={28} color="var(--accent-amber)" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Request Sent
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Your access request to <strong style={{ color: 'var(--text-primary)' }}>{foundOrg?.name}</strong> has been sent.
            An admin will review and approve your request.
          </p>
          <div className="alert alert-info">
            You'll be able to access the workspace once an admin approves your request.
            You can safely close this tab and come back later.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', marginBottom: 6 }}>
            Welcome, {user?.name?.split(' ')[0] ?? 'there'}!
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Get started by creating or joining a workspace.
          </p>
        </div>

        {step === 'choice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ChoiceCard
              id="create-org-choice"
              icon={<Building2 size={22} />}
              title="Create Organization"
              subtitle="Start fresh — set up a new org and invite your team."
              color="var(--brand-primary)"
              onClick={() => setStep('create')}
            />
            <ChoiceCard
              id="join-org-choice"
              icon={<Search size={22} />}
              title="Request Access to Existing Org"
              subtitle="Search by org slug and send an access request to the admin."
              color="var(--accent-violet)"
              onClick={() => setStep('request')}
            />
          </div>
        )}

        {step === 'create' && (
          <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: 'flex-start', marginBottom: 4 }}
              onClick={() => setStep('choice')}
            >
              ← Back
            </button>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Create Organization</h2>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="input-group">
              <label className="input-label" htmlFor="org-name">Organization Name</label>
              <input
                id="org-name"
                className="input"
                placeholder="Acme Engineering"
                value={orgName}
                onChange={handleOrgNameChange}
                required
                autoFocus
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="org-slug">
                Slug <span style={{ fontWeight: 400, color: 'var(--text-disabled)' }}>(URL-safe, auto-generated)</span>
              </label>
              <input
                id="org-slug"
                className="input"
                placeholder="acme-engineering"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                pattern="[a-z0-9-]+"
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Others will search for your org using this slug.
              </span>
            </div>
            <button
              id="create-org-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isLoading || !orgName.trim()}
            >
              {isLoading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating...</> : <><Plus size={16} /> Create Organization</>}
            </button>
          </form>
        )}

        {step === 'request' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: 'flex-start', marginBottom: 4 }}
              onClick={() => { setStep('choice'); setFoundOrg(null); setError(''); }}
            >
              ← Back
            </button>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Request Access</h2>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSearchOrg} style={{ display: 'flex', gap: 8 }}>
              <input
                id="org-slug-search"
                className="input"
                placeholder="Enter org slug (e.g. acme-engineering)"
                value={searchSlug}
                onChange={(e) => setSearchSlug(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <button
                id="search-org-btn"
                type="submit"
                className="btn btn-secondary"
                disabled={isLoading || !searchSlug.trim()}
              >
                <Search size={14} />
                Search
              </button>
            </form>

            {foundOrg && (
              <div
                style={{
                  padding: '16px 18px',
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--brand-primary)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{foundOrg.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>/{foundOrg.slug}</div>
                  </div>
                  <button
                    id="request-access-btn"
                    className="btn btn-primary"
                    onClick={handleRequestAccess}
                    disabled={isLoading}
                  >
                    <ArrowRight size={14} />
                    Request Access
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ChoiceCard: React.FC<{
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
}> = ({ id, icon, title, subtitle, color, onClick }) => (
  <button
    id={id}
    onClick={onClick}
    style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 20px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      transition: 'all 0.15s ease',
      width: '100%',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = color;
      (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
      (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
    }}
  >
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: 'var(--radius-md)',
        background: `hsla(from ${color} h s l / 0.15)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{subtitle}</div>
    </div>
    <ArrowRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
  </button>
);
