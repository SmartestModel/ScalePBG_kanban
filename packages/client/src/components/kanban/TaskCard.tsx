import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, CheckSquare, Clock } from 'lucide-react';
import { Task } from '../../types';
import { Avatar } from '../common/Avatar';
import { PriorityBadge } from '../common/Badge';

interface TaskCardProps {
  task: Task;
  assigneeName?: string;
  assigneeAvatar?: string;
  commentCount?: number;
  subtaskCount?: number;
  subtaskDoneCount?: number;
  onClick: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  assigneeName,
  assigneeAvatar,
  commentCount = 0,
  subtaskCount = 0,
  subtaskDoneCount = 0,
  onClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const subtaskProgress =
    subtaskCount > 0 ? (subtaskDoneCount / subtaskCount) * 100 : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      {/* Priority stripe */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 3,
          borderRadius: '6px 0 0 6px',
          background: getPriorityColor(task.priority),
        }}
      />
      <div style={{ paddingLeft: 8 }}>
        <div className="task-card-title">{task.title}</div>

        <div className="task-card-meta">
          <PriorityBadge priority={task.priority} showLabel={false} />
          {task.estimateHours > 0 && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              <Clock size={10} />
              {task.estimateHours}h
            </span>
          )}
        </div>

        {subtaskCount > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="progress-bar" style={{ height: 3 }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
              {subtaskDoneCount}/{subtaskCount} subtasks
            </span>
          </div>
        )}

        <div className="task-card-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {commentCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                <MessageSquare size={11} />
                {commentCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {task.assigneeId && (
              <Avatar
                name={assigneeName}
                avatarUrl={assigneeAvatar}
                size="sm"
              />
            )}
            <button
              id={`task-card-open-${task.id}`}
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px', fontSize: 11 }}
              onClick={(e) => { e.stopPropagation(); onClick(task); }}
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    urgent: 'hsl(345, 85%, 62%)',
    high:   'hsl(25, 95%, 55%)',
    medium: 'hsl(38, 92%, 50%)',
    low:    'hsl(142, 71%, 45%)',
  };
  return colors[priority] ?? 'var(--border-default)';
}
