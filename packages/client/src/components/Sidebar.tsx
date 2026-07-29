import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Layers, LayoutGrid, Inbox, Zap, Settings, LogOut,
  ChevronDown, Plus, BarChart2, UserPlus, Rocket,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { Avatar } from './common/Avatar';
import { getOrgProjects, getAccessRequests, createProject } from '../services/api';
import { Modal } from './common/Modal';
import { Project } from '../types';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const orgs = useAuthStore((s) => s.orgs);
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);

  const projects = useWorkspaceStore((s) => s.projects);
  const setProjects = useWorkspaceStore((s) => s.setProjects);
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const setActiveProject = useWorkspaceStore((s) => s.setActiveProject);

  const [pendingCount, setPendingCount] = useState(0);
  const [orgExpanded, setOrgExpanded] = useState(true);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [projectLoading, setProjectLoading] = useState(false);

  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  // Load projects for active org
  useEffect(() => {
    if (!activeOrgId) return;
    getOrgProjects(activeOrgId).then((res) => {
      if (res.success && res.data) {
        setProjects(res.data);
        if (!activeProject && res.data.length > 0) {
          setActiveProject(res.data[0]);
        }
      }
    });

    // Load pending requests badge count (admin/lead only)
    if (activeRole === 'admin') {
      getAccessRequests(activeOrgId, 'pending').then((res) => {
        if (res.success) setPendingCount(res.data?.length ?? 0);
      });
    }
  }, [activeOrgId, activeRole]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !newProjectKey.trim() || !activeOrgId) return;
    setProjectLoading(true);
    try {
      const res = await createProject(activeOrgId, {
        name: newProjectName.trim(),
        key: newProjectKey.trim().toUpperCase(),
      });
      if (res.success && res.data) {
        setProjects([...projects, res.data]);
        setActiveProject(res.data);
        setCreateProjectOpen(false);
        setNewProjectName('');
        setNewProjectKey('');
      }
    } finally {
      setProjectLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  const canCreateProject = activeRole === 'admin' || activeRole === 'lead';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Layers size={18} color="white" />
        </div>
        <span className="sidebar-logo-text">KanbanFlow</span>
      </div>

      {/* Org switcher */}
      {orgs.length > 0 && (
        <div style={{ padding: '12px 12px 4px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: 'var(--bg-glass)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
            }}
            onClick={() => setOrgExpanded(!orgExpanded)}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: 'linear-gradient(135deg, var(--brand-primary), var(--accent-violet))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 800,
                color: 'white',
                flexShrink: 0,
              }}
            >
              {activeOrg?.name?.[0]?.toUpperCase() ?? 'O'}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeOrg?.name ?? 'Select org'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {activeRole}
              </div>
            </div>
            <ChevronDown
              size={12}
              style={{
                color: 'var(--text-muted)',
                transform: orgExpanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
                flexShrink: 0,
              }}
            />
          </div>
        </div>
      )}

      {/* Main nav */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 8 }}>
        <div className="sidebar-section">Views</div>

        <NavLink
          id="nav-board"
          to="/app?view=board"
          className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          style={{ display: 'flex' }}
        >
          <LayoutGrid size={15} className="sidebar-item-icon" />
          Board
        </NavLink>

        <NavLink
          id="nav-my-tasks"
          to="/app?view=my-tasks"
          className="sidebar-item"
          style={{ display: 'flex' }}
        >
          <Inbox size={15} className="sidebar-item-icon" />
          My Tasks
        </NavLink>

        <NavLink
          id="nav-backlog"
          to="/backlog"
          className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          style={{ display: 'flex' }}
        >
          <Zap size={15} className="sidebar-item-icon" />
          Backlog
        </NavLink>

        <NavLink
          id="nav-sprints"
          to="/sprints"
          className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          style={{ display: 'flex' }}
        >
          <Rocket size={15} className="sidebar-item-icon" />
          Sprints
        </NavLink>

        {(activeRole === 'admin' || activeRole === 'lead') && (
          <NavLink
            id="nav-admin"
            to="/app?view=admin"
            className="sidebar-item"
            style={{ display: 'flex', position: 'relative' }}
          >
            <BarChart2 size={15} className="sidebar-item-icon" />
            Dashboard
            {pendingCount > 0 && (
              <span className="sidebar-item-badge">{pendingCount}</span>
            )}
          </NavLink>
        )}

        {/* Projects */}
        <div
          style={{
            padding: '12px 12px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span className="sidebar-section" style={{ padding: 0 }}>Projects</span>
          {canCreateProject && (
            <button
              id="sidebar-add-project"
              className="btn btn-ghost btn-icon"
              style={{ width: 22, height: 22, padding: 0 }}
              onClick={() => setCreateProjectOpen(true)}
              title="New Project"
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {projects.map((project) => (
          <button
            key={project.id}
            id={`nav-project-${project.id}`}
            className={`sidebar-item ${activeProject?.id === project.id ? 'active' : ''}`}
            onClick={() => setActiveProject(project)}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                background: activeProject?.id === project.id
                  ? 'var(--brand-primary)'
                  : 'var(--bg-card-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 800,
                color: activeProject?.id === project.id ? 'white' : 'var(--text-muted)',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {project.key.slice(0, 2)}
            </span>
            <span className="truncate">{project.name}</span>
          </button>
        ))}

        {projects.length === 0 && (
          <div style={{ padding: '8px 20px', fontSize: 12, color: 'var(--text-disabled)' }}>
            No projects yet
          </div>
        )}
      </div>

      {/* User footer */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size="md" />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.email}
          </div>
        </div>
        <button
          id="sign-out-btn"
          className="btn btn-ghost btn-icon"
          onClick={handleSignOut}
          title="Sign out"
          style={{ flexShrink: 0 }}
        >
          <LogOut size={15} />
        </button>
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        title="New Project"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateProjectOpen(false)}>Cancel</button>
            <button
              id="create-project-submit"
              className="btn btn-primary"
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || !newProjectKey.trim() || projectLoading}
            >
              {projectLoading ? 'Creating...' : 'Create'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Project Name</label>
            <input
              id="new-project-name"
              className="input"
              placeholder="My Awesome Project"
              value={newProjectName}
              onChange={(e) => {
                setNewProjectName(e.target.value);
                if (!newProjectKey) {
                  setNewProjectKey(e.target.value.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5));
                }
              }}
              autoFocus
            />
          </div>
          <div className="input-group">
            <label className="input-label">
              Project Key <span style={{ fontWeight: 400, color: 'var(--text-disabled)' }}>(2–5 uppercase letters)</span>
            </label>
            <input
              id="new-project-key"
              className="input"
              placeholder="MAP"
              value={newProjectKey}
              onChange={(e) => setNewProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
              maxLength={5}
            />
          </div>
        </div>
      </Modal>
    </aside>
  );
};
