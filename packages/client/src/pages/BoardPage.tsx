import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Board } from '../components/kanban/Board';
import { AdminDashboard } from '../components/views/AdminDashboard';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useBoardStore } from '../store/useBoardStore';
import { getProjectSprints, getTasks, getOrgMembers } from '../services/api';
import { useRealtimeTasks } from '../hooks/useRealtimeBoard';
import { OrgMember } from '../types';

export const BoardPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') ?? 'board';
  const filter = searchParams.get('filter') ?? 'all';

  const activeRole = useAuthStore((s) => s.activeRole);
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const activeSprint = useWorkspaceStore((s) => s.activeSprint);
  const setSprints = useWorkspaceStore((s) => s.setSprints);
  const setActiveSprint = useWorkspaceStore((s) => s.setActiveSprint);
  const setTasks = useBoardStore((s) => s.setTasks);

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Real-time task sync via Firestore onSnapshot for active project
  useRealtimeTasks(activeProject?.id ?? null);

  // Load members
  useEffect(() => {
    if (!activeOrgId) return;
    getOrgMembers(activeOrgId).then((res) => {
      if (res.success) setMembers(res.data ?? []);
    });
  }, [activeOrgId]);

  // Load active project's sprints and tasks immediately on mount/refresh
  useEffect(() => {
    if (!activeProject) return;
    setIsLoading(true);

    Promise.all([
      getTasks(activeProject.id),
      getProjectSprints(activeProject.id),
    ]).then(([tasksRes, sprintsRes]) => {
      if (tasksRes.success && tasksRes.data) {
        setTasks(tasksRes.data);
      }
      if (sprintsRes.success && sprintsRes.data) {
        setSprints(sprintsRes.data);
        const active = sprintsRes.data.find((s) => s.status === 'active') ?? sprintsRes.data[0];
        if (active) setActiveSprint(active);
      }
    }).finally(() => setIsLoading(false));
  }, [activeProject?.id]);

  if (!activeProject) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          color: 'var(--text-muted)',
        }}
      >
        <p>Select a project from the sidebar to get started.</p>
      </div>
    );
  }

  if (view === 'admin') {
    if (activeRole !== 'admin' && activeRole !== 'lead') {
      return (
        <div className="empty-state">
          <p>Admin dashboard requires Lead or Admin role.</p>
        </div>
      );
    }
    return <AdminDashboard />;
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <Board
      projectId={activeProject.id}
      sprintId={activeSprint?.id}
      members={members}
      viewFilter={filter === 'my-tasks' ? 'my-tasks' : 'all'}
      currentUserId={user?.id}
    />
  );
};
