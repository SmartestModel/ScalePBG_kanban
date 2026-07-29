import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { getOrgMembers, getAccessRequests, reviewAccessRequest, updateMemberRole } from '../../services/api';
import { OrgMember, AccessRequest } from '../../types';
import { Avatar, RoleBadge } from '../common/Avatar';
import { BurndownChart } from '../sprint/BurndownChart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Users, Clock, CheckCircle, UserPlus, Check, X } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const activeSprint = useWorkspaceStore((s) => s.activeSprint);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeOrgId) return;
    setIsLoading(true);
    Promise.all([
      getOrgMembers(activeOrgId),
      getAccessRequests(activeOrgId, 'pending'),
    ]).then(([membersRes, reqRes]) => {
      if (membersRes.success) setMembers(membersRes.data ?? []);
      if (reqRes.success) setRequests(reqRes.data ?? []);
    }).finally(() => setIsLoading(false));
  }, [activeOrgId]);

  const handleReview = async (requestId: string, status: 'approved' | 'rejected') => {
    const res = await reviewAccessRequest(requestId, status);
    if (res.success) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (status === 'approved') {
        // Refresh members
        if (activeOrgId) {
          const membersRes = await getOrgMembers(activeOrgId);
          if (membersRes.success) setMembers(membersRes.data ?? []);
        }
      }
    }
  };

  const handleRoleChange = async (uid: string, role: string) => {
    if (!activeOrgId) return;
    const res = await updateMemberRole(activeOrgId, uid, role);
    if (res.success) {
      setMembers((prev) =>
        prev.map((m) => (m.uid === uid ? { ...m, role: role as OrgMember['role'] } : m))
      );
    }
  };

  // Workload data for chart
  const workloadData = members.map((m) => ({
    name: m.name?.split(' ')[0] ?? m.email ?? 'Unknown',
    capacity: m.capacityHoursPerWeek,
  }));

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>
        Admin Dashboard
      </h1>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard icon={<Users size={20} />} label="Team Members" value={members.length} color="var(--brand-primary)" />
        <StatCard icon={<Clock size={20} />} label="Pending Requests" value={requests.length} color="var(--accent-amber)" />
        <StatCard icon={<CheckCircle size={20} />} label="Active Sprint" value={activeSprint?.name ?? '—'} color="var(--accent-emerald)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        {/* Access Requests */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <UserPlus size={16} color="var(--brand-primary)" />
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>
              Pending Access Requests
              {requests.length > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    padding: '1px 7px',
                    background: 'var(--accent-rose)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 11,
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  {requests.length}
                </span>
              )}
            </h3>
          </div>
          {requests.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
              No pending requests
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {requests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Avatar name={req.userName} avatarUrl={req.userAvatarUrl} size="md" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{req.userName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{req.userEmail}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      id={`approve-req-${req.id}`}
                      className="btn btn-sm"
                      style={{ background: 'hsla(142,71%,45%,0.15)', color: 'var(--status-done)', border: '1px solid hsla(142,71%,45%,0.3)', padding: '4px 10px' }}
                      onClick={() => handleReview(req.id, 'approved')}
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      id={`reject-req-${req.id}`}
                      className="btn btn-danger btn-sm"
                      onClick={() => handleReview(req.id, 'rejected')}
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team capacity */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Team Capacity (hrs/week)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={workloadData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
              />
              <Bar dataKey="capacity" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Capacity (hrs)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team members table */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Team Members</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((member) => (
            <div
              key={member.uid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <Avatar name={member.name} avatarUrl={member.avatarUrl} size="md" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{member.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{member.email}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {member.capacityHoursPerWeek}h/wk
              </span>
              <select
                id={`member-role-${member.uid}`}
                className="input"
                style={{ width: 110, padding: '4px 8px', fontSize: 12 }}
                value={member.role}
                onChange={(e) => handleRoleChange(member.uid, e.target.value)}
              >
                <option value="admin">Admin</option>
                <option value="lead">Lead</option>
                <option value="member">Member</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Burndown */}
      {activeSprint && (
        <div style={{ marginTop: 28 }}>
          <BurndownChart sprintId={activeSprint.id} sprintName={activeSprint.name} />
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string }> = ({
  icon, label, value, color,
}) => (
  <div className="card" style={{ padding: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 44,
          height: 44,
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
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
          {value}
        </div>
      </div>
    </div>
  </div>
);
