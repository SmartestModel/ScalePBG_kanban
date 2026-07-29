import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { PriorityBadge, StatusBadge } from '../common/Badge';
import { Task, Subtask, Comment, OrgMember } from '../../types';
import {
  getTask, addComment, addSubtask, toggleSubtask, updateTask,
} from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useBoardStore } from '../../store/useBoardStore';
import {
  Clock, MessageSquare, CheckSquare, Send, Plus, Check,
  User, Flag,
} from 'lucide-react';

interface CardDetailModalProps {
  taskId: string | null;
  members: OrgMember[];
  onClose: () => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  taskId,
  members,
  onClose,
}) => {
  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'comments' | 'subtasks'>('overview');

  const user = useAuthStore((s) => s.user);
  const upsertTask = useBoardStore((s) => s.upsertTask);

  useEffect(() => {
    if (!taskId) return;
    setIsLoading(true);
    getTask(taskId).then((res) => {
      if (res.success && res.data) {
        setTask(res.data);
        setSubtasks(res.data.subtasks ?? []);
        setComments(res.data.comments ?? []);
      }
    }).finally(() => setIsLoading(false));
  }, [taskId]);

  const handleAddComment = async () => {
    if (!commentBody.trim() || !taskId) return;
    const res = await addComment(taskId, commentBody.trim());
    if (res.success && res.data) {
      setComments((prev) => [...prev, {
        ...res.data!,
        userName: user?.name,
        userAvatarUrl: user?.avatarUrl,
      }]);
      setCommentBody('');
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !taskId) return;
    const res = await addSubtask(taskId, newSubtask.trim());
    if (res.success && res.data) {
      setSubtasks((prev) => [...prev, res.data!]);
      setNewSubtask('');
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    const res = await toggleSubtask(subtask.id, !subtask.isDone);
    if (res.success && res.data) {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? res.data! : s))
      );
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!task) return;
    const res = await updateTask(task.id, {
      version: task.version,
      status: status as Task['status'],
    });
    if (res.success && res.data) {
      setTask(res.data);
      upsertTask(res.data);
    }
  };

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const assignee = task?.assigneeId ? memberMap[task.assigneeId] : null;

  const doneSubtasks = subtasks.filter((s) => s.isDone).length;

  return (
    <Modal
      isOpen={!!taskId}
      onClose={onClose}
      size="lg"
      title={task?.title ?? 'Loading...'}
    >
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner spinner-lg" />
        </div>
      )}

      {!isLoading && task && (
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Left: main content */}
          <div style={{ flex: 1 }}>
            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 16 }}>
              {(['overview', 'comments', 'subtasks'] as const).map((tab) => (
                <button
                  key={tab}
                  id={`task-tab-${tab}`}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'overview' && 'Overview'}
                  {tab === 'comments' && `Comments (${comments.length})`}
                  {tab === 'subtasks' && `Subtasks (${doneSubtasks}/${subtasks.length})`}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                  {task.description || (
                    <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                      No description yet.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {comments.length === 0 && (
                    <div className="empty-state" style={{ padding: 24 }}>
                      <MessageSquare size={24} />
                      <span>No comments yet</span>
                    </div>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                      <Avatar name={c.userName} avatarUrl={c.userAvatarUrl} size="sm" />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{c.userName}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div
                          style={{
                            background: 'var(--bg-glass)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '8px 12px',
                            fontSize: 13,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {c.body}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size="sm" />
                  <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                    <input
                      id="comment-input"
                      className="input"
                      placeholder="Add a comment..."
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                    />
                    <button
                      id="comment-submit"
                      className="btn btn-primary btn-icon"
                      onClick={handleAddComment}
                      disabled={!commentBody.trim()}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Subtasks Tab */}
            {activeTab === 'subtasks' && (
              <div>
                {subtasks.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${(doneSubtasks / subtasks.length) * 100}%` }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      {doneSubtasks} of {subtasks.length} completed
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleToggleSubtask(sub)}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          border: `2px solid ${sub.isDone ? 'var(--status-done)' : 'var(--border-strong)'}`,
                          background: sub.isDone ? 'var(--status-done)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {sub.isDone && <Check size={11} color="white" />}
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          color: sub.isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: sub.isDone ? 'line-through' : 'none',
                          flex: 1,
                        }}
                      >
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="subtask-input"
                    className="input"
                    placeholder="Add subtask..."
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                  />
                  <button
                    id="subtask-submit"
                    className="btn btn-secondary btn-icon"
                    onClick={handleAddSubtask}
                    disabled={!newSubtask.trim()}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: metadata sidebar */}
          <div
            style={{
              width: 180,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              paddingLeft: 20,
              borderLeft: '1px solid var(--border-subtle)',
            }}
          >
            <MetaItem label="Status" icon={<CheckSquare size={13} />}>
              <select
                id="task-status-select"
                className="input"
                style={{ padding: '4px 8px', fontSize: 12 }}
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </MetaItem>

            <MetaItem label="Priority" icon={<Flag size={13} />}>
              <PriorityBadge priority={task.priority} />
            </MetaItem>

            <MetaItem label="Assignee" icon={<User size={13} />}>
              {assignee ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar name={assignee.name} avatarUrl={assignee.avatarUrl} size="sm" />
                  <span style={{ fontSize: 12 }}>{assignee.name}</span>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unassigned</span>
              )}
            </MetaItem>

            {task.estimateHours > 0 && (
              <MetaItem label="Estimate" icon={<Clock size={13} />}>
                <span style={{ fontSize: 13 }}>{task.estimateHours}h</span>
              </MetaItem>
            )}

            <MetaItem label="Created" icon={null}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(task.createdAt).toLocaleDateString()}
              </span>
            </MetaItem>
          </div>
        </div>
      )}
    </Modal>
  );
};

const MetaItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon, children }) => (
  <div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 6,
      }}
    >
      {icon}
      {label}
    </div>
    {children}
  </div>
);
