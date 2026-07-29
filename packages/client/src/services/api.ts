import axios from 'axios';
import { auth } from '../firebase/config';
import type {
  User, Organization, OrgMember, AccessRequest,
  Project, Epic, Task, Subtask, Sprint, SprintItem,
  Comment, BurndownSnapshot, ApiResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

const apiClient = axios.create({ baseURL: BASE_URL });

// Attach Firebase ID token to every request
apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────

export const syncProfile = (): Promise<ApiResponse<{ user: User; orgs: Organization[] }>> =>
  apiClient.post('/auth/sync-profile').then((r) => r.data);

export const getMe = (): Promise<ApiResponse<{ user: User; orgs: Organization[] }>> =>
  apiClient.get('/auth/me').then((r) => r.data);

// ── Organizations ─────────────────────────────────────────────────────────────

export const createOrg = (data: { name: string; slug: string }): Promise<ApiResponse<Organization>> =>
  apiClient.post('/orgs', data).then((r) => r.data);

export const searchOrgBySlug = (slug: string): Promise<ApiResponse<Pick<Organization, 'id' | 'name' | 'slug'>>> =>
  apiClient.get('/orgs/search', { params: { slug } }).then((r) => r.data);

export const getOrg = (orgId: string): Promise<ApiResponse<Organization>> =>
  apiClient.get(`/orgs/${orgId}`).then((r) => r.data);

export const getOrgMembers = (orgId: string): Promise<ApiResponse<OrgMember[]>> =>
  apiClient.get(`/orgs/${orgId}/members`).then((r) => r.data);

export const updateMemberRole = (orgId: string, uid: string, role: string): Promise<ApiResponse<void>> =>
  apiClient.patch(`/orgs/${orgId}/members/${uid}`, { role }).then((r) => r.data);

export const getAccessRequests = (orgId: string, status?: string): Promise<ApiResponse<AccessRequest[]>> =>
  apiClient.get(`/orgs/${orgId}/access-requests`, { params: { status } }).then((r) => r.data);

// ── Access Requests ───────────────────────────────────────────────────────────

export const createAccessRequest = (orgId: string): Promise<ApiResponse<AccessRequest>> =>
  apiClient.post('/access-requests', { orgId }).then((r) => r.data);

export const getMyAccessRequests = (): Promise<ApiResponse<AccessRequest[]>> =>
  apiClient.get('/access-requests/my').then((r) => r.data);

export const reviewAccessRequest = (requestId: string, status: 'approved' | 'rejected'): Promise<ApiResponse<AccessRequest>> =>
  apiClient.patch(`/access-requests/${requestId}`, { status }).then((r) => r.data);

// ── Projects ──────────────────────────────────────────────────────────────────

export const getOrgProjects = (orgId: string): Promise<ApiResponse<Project[]>> =>
  apiClient.get(`/orgs/${orgId}/projects`).then((r) => r.data);

export const createProject = (orgId: string, data: { name: string; key: string; description?: string }): Promise<ApiResponse<Project>> =>
  apiClient.post(`/orgs/${orgId}/projects`, data).then((r) => r.data);

export const getProject = (projectId: string): Promise<ApiResponse<Project>> =>
  apiClient.get(`/projects/${projectId}`).then((r) => r.data);

export const getBacklog = (projectId: string): Promise<ApiResponse<Task[]>> =>
  apiClient.get(`/projects/${projectId}/backlog`).then((r) => r.data);

export const getEpics = (projectId: string): Promise<ApiResponse<Epic[]>> =>
  apiClient.get(`/projects/${projectId}/epics`).then((r) => r.data);

export const createEpic = (projectId: string, data: { title: string; goal?: string; color?: string }): Promise<ApiResponse<Epic>> =>
  apiClient.post(`/projects/${projectId}/epics`, data).then((r) => r.data);

// ── Sprints ───────────────────────────────────────────────────────────────────

export const getProjectSprints = (projectId: string): Promise<ApiResponse<Sprint[]>> =>
  apiClient.get(`/projects/${projectId}/sprints`).then((r) => r.data);

export const createSprint = (projectId: string, data: { name: string; goal?: string; startDate?: string; endDate?: string }): Promise<ApiResponse<Sprint>> =>
  apiClient.post(`/projects/${projectId}/sprints`, data).then((r) => r.data);

export const getSprint = (sprintId: string): Promise<ApiResponse<Sprint>> =>
  apiClient.get(`/sprints/${sprintId}`).then((r) => r.data);

export const updateSprintStatus = (sprintId: string, status: string): Promise<ApiResponse<Sprint>> =>
  apiClient.patch(`/sprints/${sprintId}/status`, { status }).then((r) => r.data);

export const getSprintBoard = (sprintId: string): Promise<ApiResponse<{ items: SprintItem[]; tasks: Record<string, Task> }>> =>
  apiClient.get(`/sprints/${sprintId}/board`).then((r) => r.data);

export const addItemsToSprint = (sprintId: string, taskIds: string[]): Promise<ApiResponse<SprintItem[]>> =>
  apiClient.post(`/sprints/${sprintId}/items`, { taskIds }).then((r) => r.data);

export const removeSprintItem = (sprintId: string, taskId: string): Promise<ApiResponse<{ removed: boolean }>> =>
  apiClient.delete(`/sprints/${sprintId}/items/${taskId}`).then((r) => r.data);

export const getBurndown = (sprintId: string): Promise<ApiResponse<BurndownSnapshot[]>> =>
  apiClient.get(`/sprints/${sprintId}/burndown`).then((r) => r.data);

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const createTask = (data: {
  projectId: string; title: string; description?: string;
  priority?: string; estimateHours?: number; storyId?: string; assigneeId?: string;
  status?: string;
}): Promise<ApiResponse<Task>> =>
  apiClient.post('/tasks', data).then((r) => r.data);

export const getTask = (taskId: string): Promise<ApiResponse<Task & { subtasks: Subtask[]; comments: Comment[] }>> =>
  apiClient.get(`/tasks/${taskId}`).then((r) => r.data);

export const getTasks = (projectId: string, filter?: { status?: string; assigneeId?: string }): Promise<ApiResponse<Task[]>> =>
  apiClient.get('/tasks', { params: { projectId, ...filter } }).then((r) => r.data);

export const updateTask = (taskId: string, data: Partial<Task> & { version: number }): Promise<ApiResponse<Task>> =>
  apiClient.patch(`/tasks/${taskId}`, data).then((r) => r.data);

export const deleteTask = (taskId: string): Promise<ApiResponse<void>> =>
  apiClient.delete(`/tasks/${taskId}`).then((r) => r.data);

export const addComment = (taskId: string, body: string): Promise<ApiResponse<Comment>> =>
  apiClient.post(`/tasks/${taskId}/comments`, { body }).then((r) => r.data);

export const addSubtask = (taskId: string, title: string): Promise<ApiResponse<Subtask>> =>
  apiClient.post(`/tasks/${taskId}/subtasks`, { title }).then((r) => r.data);

export const toggleSubtask = (subtaskId: string, isDone: boolean): Promise<ApiResponse<Subtask>> =>
  apiClient.patch(`/tasks/subtasks/${subtaskId}/toggle`, { isDone }).then((r) => r.data);
