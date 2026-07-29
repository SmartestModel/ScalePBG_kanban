import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Board } from '../components/kanban/Board';
import { AdminDashboard } from '../components/views/AdminDashboard';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useBoardStore } from '../store/useBoardStore';
import { getSprintBoard, getProjectSprints } from '../services/api';
import { useRealtimeBoard } from '../hooks/useRealtimeBoard';
import { OrgMember } from '../types';
import { getOrgMembers } from '../services/api';

export const BoardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') ?? 'board';

  const activeRole = useAuthStore((s) => s.activeRole);
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const activeSprint = useWorkspaceStore((s) => s.activeSprint);
  const sprints = useWorkspaceStore((s) => s.sprints);
  const setSprints = useWorkspaceStore((s) => s.setSprints);
  const setActiveSprint = useWorkspaceStore((s) => s.setActiveSprint);
  const setTasks = useBoardStore((s) => s.setTasks);

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [sprintTaskIds, setSprintTaskIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load members
  useEffect(() => {
    if (!activeOrgId) return;
    getOrgMembers(activeOrgId).then((res) => {
      if (res.success) setMembers(res.data ?? []);
    });
  }, [activeOrgId]);

  // Load active sprint's board
  useEffect(() => {
    if (!activeProject) return;

    // Load sprints and select active one
    getProjectSprints(activeProject.id).then((res) => {
      if (!res.success || !res.data) return;
      setSprints(res.data);
      const active = res.data.find((s) => s.status === 'active') ?? res.data[0];
      if (active) setActiveSprint(active);
    });
  }, [activeProject?.id]);

  // Load board tasks when sprint changes
  useEffect(() => {
    if (!activeSprint) return;
    setIsLoading(true);
    getSprintBoard(activeSprint.id).then((res) => {
      if (!res.success || !res.data) return;
      const taskList = Object.values(res.data.tasks);
      setTasks(taskList);
      setSprintTaskIds(taskList.map((t) => t.id));
    }).finally(() => setIsLoading(false));
  }, [activeSprint?.id]);

  // Real-time board sync via Firestore onSnapshot
  useRealtimeBoard(activeSprint?.id ?? null, sprintTaskIds);

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
      viewFilter={view === 'my-tasks' ? 'my-tasks' : 'all'}
      currentUserId={user?.id}
    />
  );
};
