import {
  Task,
  CreateTaskInput,
  Subtask,
  CreateSubtaskInput,
  Sprint,
  CreateSprintInput,
  SprintItem,
  BurndownSnapshot,
  Organization,
  OrgMember,
  AccessRequest,
  AccessRequestStatus,
  User,
  Comment,
  UserRole,
  Project,
  Epic,
  Story,
} from '../types/index';

// ── Task Repository ───────────────────────────────────────────────────────────

export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findByProject(
    projectId: string,
    filter?: { status?: string; assigneeId?: string }
  ): Promise<Task[]>;
  create(input: CreateTaskInput): Promise<Task>;
  updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: Partial<Task>
  ): Promise<Task>;
  delete(id: string): Promise<boolean>;
  addSubtask(taskId: string, input: CreateSubtaskInput): Promise<Subtask>;
  getSubtasks(taskId: string): Promise<Subtask[]>;
  toggleSubtask(subtaskId: string, isDone: boolean): Promise<Subtask>;
}

// ── Sprint Repository ─────────────────────────────────────────────────────────

export interface ISprintRepository {
  findById(id: string): Promise<Sprint | null>;
  findByProject(projectId: string): Promise<Sprint[]>;
  create(input: CreateSprintInput): Promise<Sprint>;
  updateStatus(
    id: string,
    status: 'planning' | 'active' | 'closed'
  ): Promise<Sprint>;
  addItems(sprintId: string, taskIds: string[]): Promise<SprintItem[]>;
  removeItem(sprintId: string, taskId: string): Promise<boolean>;
  getItems(sprintId: string): Promise<SprintItem[]>;
  updateItemOrder(
    sprintId: string,
    itemOrders: { taskId: string; orderIndex: number; status: string }[]
  ): Promise<void>;
  getBurndownData(sprintId: string): Promise<BurndownSnapshot[]>;
}

// ── Organization Repository ───────────────────────────────────────────────────

export interface IOrgRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  findByUser(uid: string): Promise<Organization[]>;
  create(
    input: Omit<Organization, 'id' | 'createdAt'>,
    ownerUid: string
  ): Promise<Organization>;
  addMember(
    orgId: string,
    uid: string,
    role: UserRole,
    capacityHoursPerWeek?: number
  ): Promise<OrgMember>;
  getMembers(orgId: string): Promise<OrgMember[]>;
  getMember(orgId: string, uid: string): Promise<OrgMember | null>;
  updateMemberRole(orgId: string, uid: string, role: UserRole): Promise<void>;
}

// ── Access Request Repository ─────────────────────────────────────────────────

export interface IAccessRequestRepository {
  create(
    input: Omit<AccessRequest, 'id' | 'requestedAt' | 'status'>
  ): Promise<AccessRequest>;
  findById(id: string): Promise<AccessRequest | null>;
  findByOrg(
    orgId: string,
    status?: AccessRequestStatus
  ): Promise<AccessRequest[]>;
  findByUser(userId: string): Promise<AccessRequest[]>;
  updateStatus(
    id: string,
    status: AccessRequestStatus,
    reviewedBy: string
  ): Promise<AccessRequest>;
}

// ── User Repository ───────────────────────────────────────────────────────────

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  upsert(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;
}

// ── Comment Repository ────────────────────────────────────────────────────────

export interface ICommentRepository {
  findByEntity(entityType: string, entityId: string): Promise<Comment[]>;
  create(
    input: Omit<Comment, 'id' | 'createdAt'>
  ): Promise<Comment>;
}

// ── Project Repository ────────────────────────────────────────────────────────

export interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  findByOrg(orgId: string): Promise<Project[]>;
  create(
    input: Omit<Project, 'id' | 'createdAt'>
  ): Promise<Project>;
  keyExistsInOrg(orgId: string, key: string): Promise<boolean>;
  getEpics(projectId: string): Promise<Epic[]>;
  createEpic(
    input: Omit<Epic, 'id' | 'createdAt'>
  ): Promise<Epic>;
  getBacklog(projectId: string): Promise<Task[]>;
}

// ── Story Repository ──────────────────────────────────────────────────────────

export interface IStoryRepository {
  findById(id: string): Promise<Story | null>;
  findByProject(projectId: string): Promise<Story[]>;
  findByEpic(epicId: string): Promise<Story[]>;
  create(input: Omit<Story, 'id' | 'createdAt'>): Promise<Story>;
  update(id: string, changes: Partial<Story>): Promise<Story>;
  delete(id: string): Promise<boolean>;
}

// ── Repository Factory ────────────────────────────────────────────────────────

export interface IRepositoryFactory {
  getTaskRepository(): ITaskRepository;
  getSprintRepository(): ISprintRepository;
  getOrgRepository(): IOrgRepository;
  getAccessRequestRepository(): IAccessRequestRepository;
  getUserRepository(): IUserRepository;
  getCommentRepository(): ICommentRepository;
  getProjectRepository(): IProjectRepository;
  getStoryRepository(): IStoryRepository;
}
