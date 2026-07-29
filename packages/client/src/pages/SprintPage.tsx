import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useBoardStore } from '../store/useBoardStore';
import {
  getProjectSprints, createSprint, updateSprintStatus,
  getSprintBoard, addItemsToSprint, removeSprintItem, getBacklog,
} from '../services/api';
import { Sprint, Task } from '../types';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { BurndownChart } from '../components/sprint/BurndownChart';
import {
  Plus, Play, CheckCircle2, Calendar, Target, Rocket,
  BarChart2, List, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';

type SprintView = 'list' | 'burndown';

export const SprintPage: React.FC = () => {
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const activeRole    = useAuthStore((s) => s.activeRole);

  const sprints        = useWorkspaceStore((s) => s.sprints);
  const setSprints     = useWorkspaceStore((s) => s.setSprints);
  const activeSprint   = useWorkspaceStore((s) => s.activeSprint);
  const setActiveSprint = useWorkspaceStore((s) => s.setActiveSprint);

  const tasks     = useBoardStore((s) => s.tasks);
  const setTasks  = useBoardStore((s) => s.setTasks);
  const upsertTask = useBoardStore((s) => s.upsertTask);

  const [isLoading, setIsLoading]           = useState(true);
  const [sprintView, setSprintView]         = useState<SprintView>('list');
  const [createOpen, setCreateOpen]         = useState(false);
  const [sprintName, setSprintName]         = useState('');
  const [sprintGoal, setSprintGoal]         = useState('');
  const [sprintStart, setSprintStart]       = useState('');
  const [sprintEnd, setSprintEnd]           = useState('');
  const [creating, setCreating]             = useState(false);
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set());
  const [sprintItems, setSprintItems]       = useState<Record<string, Task[]>>({});
  const [backlogTasks, setBacklogTasks]     = useState<Task[]>([]);
  const [addFromBacklogOpen, setAddFromBacklogOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId]    = useState('');
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<Set<string>>(new Set());
  const [addingToSprint, setAddingToSprint] = useState(false);

  const canManage = activeRole === 'admin' || activeRole === 'lead';

  useEffect(() => {
    if (!activeProject) return;
    setIsLoading(true);
    getProjectSprints(activeProject.id)
      .then((res) => {
        if (!res.success) return;
        const loaded = res.data ?? [];
        setSprints(loaded);
        const active = loaded.find((s) => s.status === 'active') ?? loaded[0];
        if (active) {
          setActiveSprint(active);
          setExpandedSprints(new Set([active.id]));
          // Load board for active sprint
          return getSprintBoard(active.id).then((boardRes) => {
            if (boardRes.success && boardRes.data) {
              setTasks(Object.values(boardRes.data.tasks));
              setSprintItems((prev) => ({
                ...prev,
                [active.id]: Object.values(boardRes.data!.tasks),
              }));
            }
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [activeProject?.id]);

  const handleCreateSprint = async () => {
    if (!sprintName.trim() || !activeProject) return;
    setCreating(true);
    try {
      const res = await createSprint(activeProject.id, {
        name: sprintName.trim(),
        goal: sprintGoal.trim() || undefined,
        startDate: sprintStart || undefined,
        endDate: sprintEnd || undefined,
      });
      if (res.success && res.data) {
        setSprints([...sprints, res.data]);
        setSprintName('');
        setSprintGoal('');
        setSprintStart('');
        setSprintEnd('');
        setCreateOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (sprint: Sprint, status: Sprint['status']) => {
    const res = await updateSprintStatus(sprint.id, status);
    if (res.success && res.data) {
      setSprints(sprints.map((s) => (s.id === sprint.id ? res.data! : s)));
      if (status === 'active') setActiveSprint(res.data);
    }
  };

  const toggleExpand = async (sprintId: string) => {
    const next = new Set(expandedSprints);
    if (next.has(sprintId)) {
      next.delete(sprintId);
    } else {
      next.add(sprintId);
      // Load tasks if not yet loaded
      if (!sprintItems[sprintId]) {
        const res = await getSprintBoard(sprintId);
        if (res.success && res.data) {
          setSprintItems((prev) => ({
            ...prev,
            [sprintId]: Object.values(res.data!.tasks),
          }));
        }
      }
    }
    setExpandedSprints(next);
  };

  const handleOpenAddFromBacklog = async (sprintId: string) => {
    setSelectedSprintId(sprintId);
    setSelectedBacklogIds(new Set());
    if (!activeProject) return;
    const res = await getBacklog(activeProject.id);
    if (res.success) setBacklogTasks(res.data ?? []);
    setAddFromBacklogOpen(true);
  };

  const handleAddFromBacklog = async () => {
    if (!selectedSprintId || selectedBacklogIds.size === 0) return;
    setAddingToSprint(true);
    try {
      const res = await addItemsToSprint(selectedSprintId, Array.from(selectedBacklogIds));
      if (res.success) {
        // Reload sprint board
        const boardRes = await getSprintBoard(selectedSprintId);
        if (boardRes.success && boardRes.data) {
          setSprintItems((prev) => ({
            ...prev,
            [selectedSprintId]: Object.values(boardRes.data!.tasks),
          }));
        }
        setAddFromBacklogOpen(false);
        setSelectedBacklogIds(new Set());
      }
    } finally {
      setAddingToSprint(false);
    }
  };

  const handleRemoveItem = async (sprintId: string, taskId: string) => {
    const res = await removeSprintItem(sprintId, taskId);
    if (res.success) {
      setSprintItems((prev) => ({
        ...prev,
        [sprintId]: (prev[sprintId] ?? []).filter((t) => t.id !== taskId),
      }));
    }
  };

  if (!activeProject) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="empty-state-icon"><Rocket size={22} /></div>
        <p>Select a project to manage sprints.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>Sprints</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} · {activeProject.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="tabs">
            <button id="sprint-tab-list" className={`tab-btn ${sprintView === 'list' ? 'active' : ''}`} onClick={() => setSprintView('list')}>
              <List size={12} /> List
            </button>
            <button id="sprint-tab-burndown" className={`tab-btn ${sprintView === 'burndown' ? 'active' : ''}`} onClick={() => setSprintView('burndown')}>
              <BarChart2 size={12} /> Burndown
            </button>
          </div>
          {canManage && (
            <button id="create-sprint-btn" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
              <Plus size={13} /> New Sprint
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : sprintView === 'burndown' ? (
          activeSprint ? (
            <BurndownChart sprintId={activeSprint.id} sprintName={activeSprint.name} />
          ) : (
            <div className="empty-state"><p>No active sprint to show burndown for.</p></div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sprints.length === 0 && (
              <div className="empty-state" style={{ paddingTop: 60 }}>
                <div className="empty-state-icon"><Rocket size={24} /></div>
                <p style={{ fontWeight: 600 }}>No sprints yet</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Create your first sprint to start planning.</p>
                {canManage && (
                  <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                    <Plus size={14} /> Create Sprint
                  </button>
                )}
              </div>
            )}

            {sprints.map((sprint) => {
              const isExpanded = expandedSprints.has(sprint.id);
              const items = sprintItems[sprint.id] ?? [];
              const doneCount = items.filter((t) => t.status === 'done').length;
              const progress = items.length > 0 ? (doneCount / items.length) * 100 : 0;

              return (
                <div
                  key={sprint.id}
                  className="card"
                  style={{ overflow: 'hidden' }}
                >
                  {/* Sprint header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onClick={() => toggleExpand(sprint.id)}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{sprint.name}</span>
                        <SprintStatusBadge status={sprint.status} />
                        {items.length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {doneCount}/{items.length} tasks done
                          </span>
                        )}
                      </div>
                      {sprint.goal && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Target size={11} /> {sprint.goal}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {sprint.startDate && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} />
                          {new Date(sprint.startDate).toLocaleDateString()}
                          {sprint.endDate && ` → ${new Date(sprint.endDate).toLocaleDateString()}`}
                        </span>
                      )}

                      {canManage && (
                        <div
                          style={{ display: 'flex', gap: 6 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {sprint.status === 'planning' && (
                            <button
                              id={`start-sprint-${sprint.id}`}
                              className="btn btn-sm"
                              style={{ background: 'hsla(38,92%,50%,0.15)', color: 'var(--accent-amber)', border: '1px solid hsla(38,92%,50%,0.3)', padding: '4px 10px' }}
                              onClick={() => handleStatusChange(sprint, 'active')}
                            >
                              <Play size={11} /> Start
                            </button>
                          )}
                          {sprint.status === 'active' && (
                            <button
                              id={`close-sprint-${sprint.id}`}
                              className="btn btn-sm"
                              style={{ background: 'hsla(142,71%,45%,0.15)', color: 'var(--status-done)', border: '1px solid hsla(142,71%,45%,0.3)', padding: '4px 10px' }}
                              onClick={() => handleStatusChange(sprint, 'closed')}
                            >
                              <CheckCircle2 size={11} /> Close
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {items.length > 0 && (
                    <div style={{ height: 2, background: 'var(--border-subtle)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${progress}%`,
                          background: 'var(--status-done)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  )}

                  {/* Expanded items */}
                  {isExpanded && (
                    <div>
                      {items.length === 0 ? (
                        <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                          No tasks in this sprint.
                        </div>
                      ) : (
                        <div>
                          {items.map((task) => (
                            <div
                              key={task.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '9px 16px',
                                borderBottom: '1px solid var(--border-subtle)',
                              }}
                            >
                              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{task.title}</span>
                              <PriorityBadge priority={task.priority} showLabel={false} />
                              <StatusBadge status={task.status} />
                              {canManage && (
                                <button
                                  id={`remove-sprint-item-${task.id}`}
                                  className="btn btn-ghost btn-icon btn-sm"
                                  onClick={() => handleRemoveItem(sprint.id, task.id)}
                                  title="Remove from sprint"
                                  style={{ opacity: 0.5 }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {canManage && sprint.status !== 'closed' && (
                        <div style={{ padding: '10px 16px' }}>
                          <button
                            id={`add-from-backlog-${sprint.id}`}
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleOpenAddFromBacklog(sprint.id)}
                          >
                            <Plus size={12} /> Add from backlog
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create sprint modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Sprint"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button
              id="create-sprint-submit"
              className="btn btn-primary"
              onClick={handleCreateSprint}
              disabled={!sprintName.trim() || creating}
            >
              {creating ? 'Creating...' : 'Create Sprint'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Sprint Name</label>
            <input
              id="sprint-name-input"
              className="input"
              placeholder="Sprint 1"
              value={sprintName}
              onChange={(e) => setSprintName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="input-group">
            <label className="input-label">Sprint Goal (optional)</label>
            <input
              id="sprint-goal-input"
              className="input"
              placeholder="What do we aim to achieve?"
              value={sprintGoal}
              onChange={(e) => setSprintGoal(e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Start Date</label>
              <input
                id="sprint-start-date"
                className="input"
                type="date"
                value={sprintStart}
                onChange={(e) => setSprintStart(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">End Date</label>
              <input
                id="sprint-end-date"
                className="input"
                type="date"
                value={sprintEnd}
                onChange={(e) => setSprintEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Add from backlog modal */}
      <Modal
        isOpen={addFromBacklogOpen}
        onClose={() => setAddFromBacklogOpen(false)}
        title="Add from Backlog"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAddFromBacklogOpen(false)}>Cancel</button>
            <button
              id="confirm-add-backlog"
              className="btn btn-primary"
              onClick={handleAddFromBacklog}
              disabled={selectedBacklogIds.size === 0 || addingToSprint}
            >
              {addingToSprint ? 'Adding...' : `Add ${selectedBacklogIds.size} tasks`}
            </button>
          </>
        }
      >
        {backlogTasks.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <p>No backlog tasks available.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            {backlogTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: selectedBacklogIds.has(task.id) ? 'var(--brand-subtle)' : 'var(--bg-glass)',
                  border: `1px solid ${selectedBacklogIds.has(task.id) ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
                onClick={() => {
                  setSelectedBacklogIds((prev) => {
                    const next = new Set(prev);
                    next.has(task.id) ? next.delete(task.id) : next.add(task.id);
                    return next;
                  });
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedBacklogIds.has(task.id)}
                  readOnly
                  style={{ accentColor: 'var(--brand-primary)' }}
                />
                <span style={{ flex: 1, fontSize: 13 }}>{task.title}</span>
                <PriorityBadge priority={task.priority} showLabel={false} />
                {task.estimateHours > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.estimateHours}h</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

const SprintStatusBadge: React.FC<{ status: Sprint['status'] }> = ({ status }) => {
  const styles: Record<Sprint['status'], { bg: string; color: string; border: string; label: string }> = {
    planning: { bg: 'var(--brand-subtle)', color: 'var(--brand-primary)', border: 'hsla(217,91%,60%,0.3)', label: 'Planning' },
    active:   { bg: 'hsla(38,92%,50%,0.15)', color: 'var(--accent-amber)', border: 'hsla(38,92%,50%,0.3)', label: 'Active' },
    closed:   { bg: 'hsla(142,71%,45%,0.12)', color: 'var(--status-done)', border: 'hsla(142,71%,45%,0.25)', label: 'Closed' },
  };
  const s = styles[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
};
