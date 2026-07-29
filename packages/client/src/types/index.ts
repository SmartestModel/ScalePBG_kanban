// ── Domain Types (mirrors server types) ──────────────────────────────────────

export type UserRole = 'admin' | 'lead' | 'member';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type SprintStatus = 'planning' | 'active' | 'closed';
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface OrgMember {
  uid: string;
  role: UserRole;
  capacityHoursPerWeek: number;
  joinedAt: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface AccessRequest {
  id: string;
  orgId: string;
  orgName?: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatarUrl?: string;
  status: AccessRequestStatus;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Project {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Epic {
  id: string;
  projectId: string;
  title: string;
  goal?: string;
  color: string;
  status: 'open' | 'in_progress' | 'closed';
  createdAt: string;
}

export interface Story {
  id: string;
  epicId?: string;
  projectId: string;
  title: string;
  description?: string;
  storyPoints: number;
  priority: TaskPriority;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  storyId?: string;
  assigneeId?: string;
  title: string;
  description?: string;
  estimateHours: number;
  priority: TaskPriority;
  status: TaskStatus;
  labelIds: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  orderIndex: number;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  status: SprintStatus;
  createdAt: string;
}

export interface SprintItem {
  id: string;
  sprintId: string;
  taskId: string;
  status: TaskStatus;
  orderIndex: number;
}

export interface Comment {
  id: string;
  entityType: 'task' | 'story' | 'epic';
  entityId: string;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  body: string;
  createdAt: string;
}

export interface Label {
  id: string;
  orgId: string;
  name: string;
  color: string;
}

export interface BurndownSnapshot {
  date: string;
  remainingPoints: number;
  idealPoints: number;
  completedPoints: number;
}

// ── Board Column Config ───────────────────────────────────────────────────────

export interface BoardColumn {
  id: TaskStatus;
  title: string;
  color: string;
  wipLimit?: number;
}

export const BOARD_COLUMNS: BoardColumn[] = [
  { id: 'backlog',     title: 'Backlog',      color: 'hsl(215, 16%, 47%)',  wipLimit: 0  },
  { id: 'todo',        title: 'To Do',        color: 'hsl(217, 91%, 60%)',  wipLimit: 0  },
  { id: 'in_progress', title: 'In Progress',  color: 'hsl(38, 92%, 50%)',   wipLimit: 5  },
  { id: 'in_review',   title: 'In Review',    color: 'hsl(270, 91%, 65%)',  wipLimit: 3  },
  { id: 'done',        title: 'Done',         color: 'hsl(142, 71%, 45%)',  wipLimit: 0  },
];

// ── API Response wrapper ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message: string; currentVersion?: number };
}
