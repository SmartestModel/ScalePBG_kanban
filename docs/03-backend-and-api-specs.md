# 03. Backend & API Specifications

This document specifies the REST API endpoints, WebSocket events, and TypeScript Repository Interface contracts required for the backend service.

---

## 1. Abstract Repository Interfaces

To ensure complete storage driver independence, all backend controllers depend solely on these TypeScript interface abstractions:

```typescript
// 1. Task Repository Interface
export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findByProject(projectId: string, filter?: TaskFilter): Promise<Task[]>;
  create(task: CreateTaskInput): Promise<Task>;
  updateWithVersion(id: string, version: number, changes: Partial<Task>): Promise<Task>;
  delete(id: string): Promise<boolean>;
  addSubtask(taskId: string, input: CreateSubtaskInput): Promise<Subtask>;
  toggleSubtask(subtaskId: string, isDone: boolean): Promise<Subtask>;
}

// 2. Sprint Repository Interface
export interface ISprintRepository {
  findById(id: string): Promise<Sprint | null>;
  findByProject(projectId: string): Promise<Sprint[]>;
  create(sprint: CreateSprintInput): Promise<Sprint>;
  updateStatus(id: string, status: 'planning' | 'active' | 'closed'): Promise<Sprint>;
  addItems(sprintId: string, taskIds: string[]): Promise<SprintItem[]>;
  updateItemOrder(sprintId: string, itemOrders: { taskId: string; orderIndex: number; status: string }[]): Promise<void>;
  getBurndownData(sprintId: string): Promise<BurndownSnapshot[]>;
}

// 3. Workspace Repository Interface
export interface IWorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  findByUser(userId: string): Promise<Workspace[]>;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  addMember(workspaceId: string, userId: string, role: 'admin' | 'lead' | 'member', capacityHrs: number): Promise<WorkspaceMember>;
  getMembers(workspaceId: string): Promise<WorkspaceMemberDetail[]>;
}

// 4. User Repository Interface
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: CreateUserInput): Promise<User>;
}

// 5. Comment Repository Interface
export interface ICommentRepository {
  findByEntity(entityType: string, entityId: string): Promise<Comment[]>;
  create(input: CreateCommentInput): Promise<Comment>;
}
```

---

## 2. REST API Endpoints Specification

### Authentication & User Management
```
POST /api/v1/auth/register    -> Register user credentials
POST /api/v1/auth/login       -> Authenticate and return JWT token or Firebase Auth bridge
GET  /api/v1/auth/me          -> Fetch current user profile
```

### Workspaces & Teams
```
GET    /api/v1/workspaces             -> List workspaces for current user
POST   /api/v1/workspaces             -> Create workspace
GET    /api/v1/workspaces/:id/members -> List members & capacity
POST   /api/v1/workspaces/:id/members -> Invite member / assign role
```

### Projects & Backlog
```
GET    /api/v1/projects/:id           -> Get project details
POST   /api/v1/workspaces/:id/projects -> Create project
GET    /api/v1/projects/:id/backlog   -> Get unassigned backlog items (Stories & Tasks)
```

### Sprints & Board Execution
```
GET    /api/v1/projects/:id/sprints   -> List sprints (active, planning, closed)
POST   /api/v1/projects/:id/sprints   -> Create sprint
POST   /api/v1/sprints/:id/items      -> Add task(s) to sprint
PATCH  /api/v1/sprints/:id/status     -> Update sprint status (planning -> active -> closed)
GET    /api/v1/sprints/:id/board      -> Get sprint board columns & items
GET    /api/v1/sprints/:id/burndown   -> Get burndown snapshot series
```

### Tasks & Drag-and-Drop Concurrency
```
GET    /api/v1/tasks/:id              -> Get task details with comments & subtasks
POST   /api/v1/tasks                  -> Create task
PATCH  /api/v1/tasks/:id              -> Update task (Requires 'version' attribute in payload)
DELETE /api/v1/tasks/:id              -> Delete task
POST   /api/v1/tasks/:id/comments     -> Add comment
POST   /api/v1/tasks/:id/subtasks     -> Add subtask checklist item
```

---

## 3. Optimistic Locking & Concurrency Control

When moving tasks across columns or updating task attributes, clients must include the entity's current `version` integer:

### HTTP Request
```http
PATCH /api/v1/tasks/task-101 HTTP/1.1
Content-Type: application/json

{
  "version": 4,
  "status": "in_review",
  "assignee_id": "usr-202"
}
```

### Server Handling Logic
```typescript
async function handleTaskUpdate(taskId: string, expectedVersion: number, changes: Partial<Task>) {
  const currentTask = await taskRepo.findById(taskId);
  if (!currentTask) throw new NotFoundError('Task not found');
  
  if (currentTask.version !== expectedVersion) {
    throw new ConflictError(`Task version mismatch. Current version is ${currentTask.version}`);
  }

  const updatedTask = await taskRepo.updateWithVersion(taskId, expectedVersion, {
    ...changes,
    version: expectedVersion + 1,
  });

  return updatedTask;
}
```

### HTTP Response on Conflict (409 Conflict)
```json
{
  "error": "CONFLICT_DETECTED",
  "message": "Task has been updated by another user.",
  "current_version": 5,
  "latest_task_state": {
    "id": "task-101",
    "version": 5,
    "status": "in_progress"
  }
}
```

---

## 4. Standard Error Response Schema

All API error responses follow a structured JSON shape:

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Member role cannot alter sprint capacity.",
    "details": null
  },
  "timestamp": "2026-07-28T18:00:00Z"
}
```

---

## 5. Next Steps

- Proceed to [04-firebase-and-memory-adapters.md](file:///c:/Users/ayush/Pictures/kanban/docs/04-firebase-and-memory-adapters.md) for concrete adapter implementation specs.
