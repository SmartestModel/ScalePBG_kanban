// ── Domain Entity Types ───────────────────────────────────────────────────────

export type UserRole = 'admin' | 'lead' | 'member';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done';
export type SprintStatus = 'planning' | 'active' | 'closed';
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

// ── User ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string; // Firebase Auth UID
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Organization (Workspace) ──────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string; // URL-safe unique identifier
  ownerId: string;
  createdAt: string;
}

export interface OrgMember {
  uid: string;
  role: UserRole;
  capacityHoursPerWeek: number;
  joinedAt: string;
  // Denormalized for display
  name?: string;
  email?: string;
  avatarUrl?: string;
}

// ── Access Request ─────────────────────────────────────────────────────────────

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

// ── Project ───────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  orgId: string;
  key: string; // e.g. "KAN"
  name: string;
  description?: string;
  createdAt: string;
}

// ── Epic ──────────────────────────────────────────────────────────────────────

export interface Epic {
  id: string;
  projectId: string;
  title: string;
  goal?: string;
  color: string;
  status: 'open' | 'in_progress' | 'closed';
  createdAt: string;
}

// ── Story ─────────────────────────────────────────────────────────────────────

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

// ── Task ──────────────────────────────────────────────────────────────────────

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

// ── Subtask ───────────────────────────────────────────────────────────────────

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  orderIndex: number;
}

// ── Sprint ────────────────────────────────────────────────────────────────────

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

// ── Sprint Item ───────────────────────────────────────────────────────────────

export interface SprintItem {
  id: string;
  sprintId: string;
  taskId: string;
  status: TaskStatus;
  orderIndex: number;
}

// ── Comment ───────────────────────────────────────────────────────────────────

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

// ── Label ─────────────────────────────────────────────────────────────────────

export interface Label {
  id: string;
  orgId: string;
  name: string;
  color: string;
}

// ── Activity Log ──────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  action: string;
  diffJson?: Record<string, unknown>;
  createdAt: string;
}

// ── Burndown Snapshot ─────────────────────────────────────────────────────────

export interface BurndownSnapshot {
  date: string;
  remainingPoints: number;
  idealPoints: number;
  completedPoints: number;
}

// ── Input DTOs ────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  projectId: string;
  storyId?: string;
  assigneeId?: string;
  title: string;
  description?: string;
  estimateHours?: number;
  priority?: TaskPriority;
  status?: TaskStatus;
  labelIds?: string[];
}

export interface CreateSprintInput {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateSubtaskInput {
  title: string;
}

// ── Request Context ───────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role?: UserRole;
  orgId?: string;
}
