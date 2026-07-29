import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useBoardStore } from '../store/useBoardStore';
import { useRealtimeTasks } from '../hooks/useRealtimeBoard';
import { getBacklog, getProjectSprints, addItemsToSprint, createTask } from '../services/api';
import { Task, Sprint, TaskStatus, TaskPriority, BOARD_COLUMNS } from '../types';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';
import { Avatar } from '../components/common/Avatar';
import { Modal } from '../components/common/Modal';
import { getOrgMembers } from '../services/api';
import { OrgMember } from '../types';
import {
  Plus, Filter, ArrowUpDown, Inbox, Rocket, Clock, MoreHorizontal,
} from 'lucide-react';

type SortKey = 'priority' | 'created' | 'estimate';
type FilterStatus = 'all' | TaskStatus;

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

export const BacklogPage: React.FC = () => {
  const activeOrgId  = useAuthStore((s) => s.activeOrgId);
  const activeRole   = useAuthStore((s) => s.activeRole);
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const tasks        = useBoardStore((s) => s.tasks);
  const setTasks     = useBoardStore((s) => s.setTasks);
  const upsertTask   = useBoardStore((s) => s.upsertTask);

  const [sprints, setSprints]               = useState<Sprint[]>([]);
  const [members, setMembers]               = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [sortKey, setSortKey]               = useState<SortKey>('priority');
  const [filterStatus, setFilterStatus]     = useState<FilterStatus>('all');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [addToSprintOpen, setAddToSprintOpen] = useState(false);
  const [targetSprintId, setTargetSprintId] = useState('');
  const [addingToSprint, setAddingToSprint] = useState(false);
  const [createOpen, setCreateOpen]         = useState(false);
  const [newTitle, setNewTitle]             = useState('');
  const [newPriority, setNewPriority]       = useState<TaskPriority>('medium');
  const [newEstimate, setNewEstimate]       = useState('');
  const [creating, setCreating]             = useState(false);

  // Real-time updates
  useRealtimeTasks(activeProject?.id ?? null);

  useEffect(() => {
    if (!activeProject || !activeOrgId) return;
    setIsLoading(true);

    Promise.all([
      getBacklog(activeProject.id),
      getProjectSprints(activeProject.id),
      getOrgMembers(activeOrgId),
    ]).then(([backlogRes, sprintsRes, membersRes]) => {
      if (backlogRes.success && backlogRes.data) setTasks(backlogRes.data);
      if (sprintsRes.success)  setSprints(sprintsRes.data ?? []);
      if (membersRes.success)  setMembers(membersRes.data ?? []);
    }).finally(() => setIsLoading(false));
  }, [activeProject?.id, activeOrgId]);

  const backlogTasks = Object.values(tasks).filter(
    (t) => t.projectId === activeProject?.id && t.status === 'backlog'
  );

  const filtered = backlogTasks.filter(
    (t) => filterStatus === 'all' || t.status === filterStatus
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (sortKey === 'estimate') return b.estimateHours - a.estimateHours;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const planningOrActiveSprints = sprints.filter(
    (s) => s.status === 'planning' || s.status === 'active'
  );

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.size === sorted.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(sorted.map((t) => t.id)));
    }
  };

  const handleAddToSprint = async () => {
    if (!targetSprintId || selectedTaskIds.size === 0) return;
    setAddingToSprint(true);
    try {
      const res = await addItemsToSprint(targetSprintId, Array.from(selectedTaskIds));
      if (res.success) {
        setSelectedTaskIds(new Set());
        setAddToSprintOpen(false);
        // Update status to 'todo' for moved tasks
        Array.from(selectedTaskIds).forEach((id) => {
          const t = tasks[id];
          if (t) upsertTask({ ...t, status: 'todo' });
        });
      }
    } finally {
      setAddingToSprint(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim() || !activeProject) return;
    setCreating(true);
    try {
      const res = await createTask({
        projectId: activeProject.id,
        title: newTitle.trim(),
        priority: newPriority,
        estimateHours: parseFloat(newEstimate) || 0,
        status: 'backlog',
      });
      if (res.success && res.data) {
        upsertTask(res.data);
        setNewTitle('');
        setNewEstimate('');
        setNewPriority('medium');
        setCreateOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const totalEstimate = sorted.reduce((sum, t) => sum + t.estimateHours, 0);

  if (!activeProject) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="empty-state-icon"><Inbox size={22} /></div>
        <p>Select a project from the sidebar to view its backlog.</p>
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
          <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>Backlog</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {sorted.length} items · {totalEstimate}h total estimate
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
            <select
              id="backlog-sort"
              className="input"
              style={{ padding: '5px 10px', fontSize: 12, width: 130 }}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="priority">By Priority</option>
              <option value="created">By Date</option>
              <option value="estimate">By Estimate</option>
            </select>
          </div>

          {/* Move to sprint (bulk) */}
          {selectedTaskIds.size > 0 && (activeRole === 'admin' || activeRole === 'lead') && (
            <button
              id="move-to-sprint-btn"
              className="btn btn-primary btn-sm"
              onClick={() => setAddToSprintOpen(true)}
            >
              <Rocket size={13} />
              Move to Sprint ({selectedTaskIds.size})
            </button>
          )}

          <button
            id="backlog-add-task"
            className="btn btn-primary btn-sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={13} />
            Add Task
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <div className="empty-state-icon"><Inbox size={24} /></div>
            <p style={{ fontWeight: 600 }}>Backlog is empty</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Add tasks here before pulling them into a sprint.
            </p>
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Add first task
            </button>
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: '0 4px',
              marginTop: 12,
            }}
          >
            <thead>
              <tr
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                <th style={{ width: 36, paddingBottom: 8 }}>
                  <input
                    id="backlog-select-all"
                    type="checkbox"
                    checked={selectedTaskIds.size === sorted.length && sorted.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                  />
                </th>
                <th style={{ textAlign: 'left', paddingBottom: 8 }}>Title</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, width: 110 }}>Priority</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, width: 90 }}>Status</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, width: 90 }}>Assignee</th>
                <th style={{ textAlign: 'right', paddingBottom: 8, width: 80 }}>Estimate</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((task) => {
                const assignee = task.assigneeId ? memberMap[task.assigneeId] : null;
                const isSelected = selectedTaskIds.has(task.id);
                return (
                  <tr
                    key={task.id}
                    style={{
                      background: isSelected ? 'var(--brand-subtle)' : 'var(--bg-card)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                    onClick={() => toggleSelectTask(task.id)}
                  >
                    <td
                      style={{ padding: '10px 8px 10px 12px', borderRadius: '8px 0 0 8px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectTask(task.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                      />
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                        }}
                      >
                        {task.title}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <StatusBadge status={task.status} />
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {assignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={assignee.name} avatarUrl={assignee.avatarUrl} size="sm" />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {assignee.name?.split(' ')[0]}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>—</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px 10px 8px',
                        textAlign: 'right',
                        borderRadius: '0 8px 8px 0',
                      }}
                    >
                      {task.estimateHours > 0 ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, fontSize: 12, color: 'var(--text-muted)' }}>
                          <Clock size={11} />
                          {task.estimateHours}h
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Move to sprint modal */}
      <Modal
        isOpen={addToSprintOpen}
        onClose={() => setAddToSprintOpen(false)}
        title="Move to Sprint"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAddToSprintOpen(false)}>
              Cancel
            </button>
            <button
              id="confirm-move-sprint"
              className="btn btn-primary"
              onClick={handleAddToSprint}
              disabled={!targetSprintId || addingToSprint}
            >
              {addingToSprint ? 'Moving...' : `Move ${selectedTaskIds.size} tasks`}
            </button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label">Select Sprint</label>
          {planningOrActiveSprints.length === 0 ? (
            <div className="alert alert-info">
              No active or planning sprints found. Create a sprint first.
            </div>
          ) : (
            <select
              id="sprint-select"
              className="input"
              value={targetSprintId}
              onChange={(e) => setTargetSprintId(e.target.value)}
            >
              <option value="">— Select sprint —</option>
              {planningOrActiveSprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          )}
        </div>
      </Modal>

      {/* Create task modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Backlog Item"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button
              id="create-backlog-submit"
              className="btn btn-primary"
              onClick={handleCreateTask}
              disabled={!newTitle.trim() || creating}
            >
              {creating ? 'Creating...' : 'Add to Backlog'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Title</label>
            <input
              id="new-backlog-title"
              className="input"
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
              autoFocus
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Priority</label>
              <select
                id="new-backlog-priority"
                className="input"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Estimate (hours)</label>
              <input
                id="new-backlog-estimate"
                className="input"
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={newEstimate}
                onChange={(e) => setNewEstimate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
