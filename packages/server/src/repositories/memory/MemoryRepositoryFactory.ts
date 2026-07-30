import { IRepositoryFactory } from '../../interfaces/repositories';
import { MemoryTaskRepository } from './MemoryTaskRepository';
import { MemorySprintRepository } from './MemorySprintRepository';
import { MemoryOrgRepository } from './MemoryOrgRepository';
import {
  MemoryAccessRequestRepository,
} from './MemoryAccessRequestRepository';
import { MemoryUserRepository } from './MemoryUserRepository';
import { MemoryCommentRepository } from './MemoryCommentRepository';
import { MemoryProjectRepository } from './MemoryProjectRepository';
import { MemoryStoryRepository } from './MemoryStoryRepository';
import {
  User,
  Organization,
  OrgMember,
  Project,
  Epic,
  Story,
  Task,
  Sprint,
  SprintItem,
} from '../../types/index';

// ── Static seed identifiers ────────────────────────────────────────────────────
// Keep IDs stable so cross-entity references always resolve.

const DEMO_USER_ID   = 'demo-user-1';
const DEMO_ORG_ID    = 'demo-org-1';
const DEMO_PROJECT_ID = 'demo-project-1';
const DEMO_SPRINT_ID  = 'demo-sprint-1';

// ── Seed data ──────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

const seedUser: User = {
  id: DEMO_USER_ID,
  email: 'demo@example.com',
  name: 'Demo User',
  avatarUrl: undefined,
  createdAt: now,
  updatedAt: now,
};

const seedOrg: Organization = {
  id: DEMO_ORG_ID,
  name: 'Demo Workspace',
  slug: 'demo-workspace',
  ownerId: DEMO_USER_ID,
  createdAt: now,
};

const seedMember: OrgMember = {
  uid: DEMO_USER_ID,
  role: 'admin',
  capacityHoursPerWeek: 40,
  joinedAt: now,
  name: seedUser.name,
  email: seedUser.email,
};

const seedProject: Project = {
  id: DEMO_PROJECT_ID,
  orgId: DEMO_ORG_ID,
  key: 'DEM',
  name: 'Demo Project',
  description: 'Pre-seeded project for feature testing.',
  createdAt: now,
};

const seedEpics: Epic[] = [
  {
    id: 'demo-epic-1',
    projectId: DEMO_PROJECT_ID,
    title: 'Core Platform Setup',
    goal: 'Establish baseline application architecture and security',
    color: '#3B82F6',
    status: 'in_progress',
    createdAt: now,
  },
  {
    id: 'demo-epic-2',
    projectId: DEMO_PROJECT_ID,
    title: 'Agile Workflow & Board Features',
    goal: 'Provide real-time board, backlog management, and sprint planning',
    color: '#8B5CF6',
    status: 'open',
    createdAt: now,
  },
];

const seedStories: Story[] = [
  {
    id: 'demo-story-1',
    epicId: 'demo-epic-1',
    projectId: DEMO_PROJECT_ID,
    title: 'User Authentication & Workspaces',
    description: 'Implement multi-tenant auth and org member role mapping',
    storyPoints: 5,
    priority: 'high',
    createdAt: now,
  },
  {
    id: 'demo-story-2',
    epicId: 'demo-epic-2',
    projectId: DEMO_PROJECT_ID,
    title: 'Interactive Board & Card Drag-Drop',
    description: 'Kanban view with real-time updates and WIP limits',
    storyPoints: 8,
    priority: 'urgent',
    createdAt: now,
  },
];

const seedTasks: Task[] = [
  {
    id: 'demo-task-1',
    projectId: DEMO_PROJECT_ID,
    title: 'Set up project structure',
    description: 'Initialize the repository and configure tooling.',
    estimateHours: 4,
    priority: 'high',
    status: 'done',
    labelIds: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    assigneeId: DEMO_USER_ID,
  },
  {
    id: 'demo-task-2',
    projectId: DEMO_PROJECT_ID,
    title: 'Implement authentication flow',
    description: 'Google OAuth via Firebase with profile sync.',
    estimateHours: 6,
    priority: 'urgent',
    status: 'in_progress',
    labelIds: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    assigneeId: DEMO_USER_ID,
  },
  {
    id: 'demo-task-3',
    projectId: DEMO_PROJECT_ID,
    title: 'Build kanban board UI',
    description: 'Drag-and-drop board with column filtering.',
    estimateHours: 8,
    priority: 'high',
    status: 'todo',
    labelIds: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-task-4',
    projectId: DEMO_PROJECT_ID,
    title: 'API integration for tasks',
    description: 'Wire up the REST API endpoints for CRUD operations.',
    estimateHours: 5,
    priority: 'medium',
    status: 'backlog',
    labelIds: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-task-5',
    projectId: DEMO_PROJECT_ID,
    title: 'Write unit tests for repositories',
    description: 'Cover all public methods with Jest tests.',
    estimateHours: 3,
    priority: 'low',
    status: 'backlog',
    labelIds: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  },
];

const seedSprint: Sprint = {
  id: DEMO_SPRINT_ID,
  projectId: DEMO_PROJECT_ID,
  name: 'Sprint 1 — Kickoff',
  goal: 'Get core auth and board features done.',
  startDate: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  endDate: new Date(Date.now() + 11 * 86_400_000).toISOString(),
  status: 'active',
  createdAt: now,
};

const seedSprintItems: SprintItem[] = [
  {
    id: 'demo-item-1',
    sprintId: DEMO_SPRINT_ID,
    taskId: 'demo-task-1',
    status: 'done',
    orderIndex: 0,
  },
  {
    id: 'demo-item-2',
    sprintId: DEMO_SPRINT_ID,
    taskId: 'demo-task-2',
    status: 'in_progress',
    orderIndex: 1,
  },
  {
    id: 'demo-item-3',
    sprintId: DEMO_SPRINT_ID,
    taskId: 'demo-task-3',
    status: 'todo',
    orderIndex: 2,
  },
];

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * In-memory repository factory.
 * All repositories share the same underlying data maps so cross-repo
 * queries (e.g. burndown reading task estimates) remain consistent.
 */
export class MemoryRepositoryFactory implements IRepositoryFactory {
  private taskRepo: MemoryTaskRepository;
  private sprintRepo: MemorySprintRepository;
  private orgRepo: MemoryOrgRepository;
  private accessRepo: MemoryAccessRequestRepository;
  private userRepo: MemoryUserRepository;
  private commentRepo: MemoryCommentRepository;
  private projectRepo: MemoryProjectRepository;
  private storyRepo: MemoryStoryRepository;

  constructor() {
    // Build a shared tasks Map so both task and project repos see
    // the same data (needed for backlog queries).
    const sharedTasks = new Map<string, Task>();
    for (const t of seedTasks) sharedTasks.set(t.id, t);

    this.taskRepo = new MemoryTaskRepository(seedTasks);
    this.sprintRepo = new MemorySprintRepository(
      [seedSprint],
      seedSprintItems
    );

    // Wire burndown resolver to the shared task map
    this.sprintRepo.setTaskEstimateResolver(async (taskId) => {
      const task = sharedTasks.get(taskId);
      return task?.estimateHours ?? 0;
    });

    this.orgRepo = new MemoryOrgRepository(
      [seedOrg],
      [{ orgId: DEMO_ORG_ID, member: seedMember }]
    );
    this.accessRepo = new MemoryAccessRequestRepository();
    this.userRepo = new MemoryUserRepository([seedUser]);
    this.commentRepo = new MemoryCommentRepository();
    this.projectRepo = new MemoryProjectRepository(
      sharedTasks,
      [seedProject],
      seedEpics
    );
    this.storyRepo = new MemoryStoryRepository(seedStories);

    console.log(
      '[Mock] In-memory repositories initialised with seed data.'
    );
    console.log(
      `[Mock] Demo user: ${seedUser.email} (uid: ${DEMO_USER_ID})`
    );
    console.log(
      `[Mock] Demo org: "${seedOrg.name}" (id: ${DEMO_ORG_ID})`
    );
  }

  getTaskRepository()          { return this.taskRepo; }
  getSprintRepository()        { return this.sprintRepo; }
  getOrgRepository()           { return this.orgRepo; }
  getAccessRequestRepository() { return this.accessRepo; }
  getUserRepository()          { return this.userRepo; }
  getCommentRepository()       { return this.commentRepo; }
  getProjectRepository()       { return this.projectRepo; }
  getStoryRepository()         { return this.storyRepo; }
}
