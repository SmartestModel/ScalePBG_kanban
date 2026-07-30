import React from 'react';
import { TaskPriority, TaskStatus } from '../../types';
import {
  AlertCircle, ArrowUp, ArrowRight, ArrowDown, ChevronDown,
  Circle, CheckCircle2, LayoutList, GitPullRequest, Loader2,
} from 'lucide-react';

// ── Priority Badge ────────────────────────────────────────────────────────────

const PRIORITY_ICONS: Record<TaskPriority, React.ReactNode> = {
  urgent: <AlertCircle size={10} />,
  high:   <ArrowUp size={10} />,
  medium: <ArrowRight size={10} />,
  low:    <ArrowDown size={10} />,
  lowest: <ChevronDown size={10} />,
};

interface PriorityBadgeProps {
  priority: TaskPriority;
  showLabel?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  showLabel = true,
}) => (
  <span className={`badge badge-${priority}`}>
    {PRIORITY_ICONS[priority]}
    {showLabel && priority.charAt(0).toUpperCase() + priority.slice(1)}
  </span>
);

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  backlog:     <LayoutList size={10} />,
  todo:        <Circle size={10} />,
  in_progress: <Loader2 size={10} />,
  in_review:   <GitPullRequest size={10} />,
  done:        <CheckCircle2 size={10} />,
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog:     'Backlog',
  todo:        'To Do',
  in_progress: 'In Progress',
  in_review:   'In Review',
  done:        'Done',
};

interface StatusBadgeProps {
  status: TaskStatus;
  showLabel?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showLabel = true,
}) => (
  <span className={`badge badge-${status.replace('_', '-')}`}>
    {STATUS_ICONS[status]}
    {showLabel && STATUS_LABELS[status]}
  </span>
);
