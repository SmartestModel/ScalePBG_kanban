# 02. Data Models & Storage Specifications

This document defines the data structures, schemas, and persistence mapping for all three supported drivers: **PostgreSQL**, **Firebase Firestore**, and **In-Memory**.

---

## 1. Unified Domain Entities

The core system is structured around 14 domain entities:

1. **User:** Account profile, email, authentication credentials.
2. **Workspace:** Top-level tenant context (a company or team domain).
3. **Workspace Member:** Junction entity assigning role (`admin`, `lead`, `member`) and weekly capacity hours.
4. **Project:** Discrete software or task initiative within a workspace.
5. **Epic:** Large body of work spanning multiple sprints.
6. **Story:** User story or feature container assigned to an epic.
7. **Task:** Individual unit of executable work with story point estimates, assignee, status, and optimistic lock `version`.
8. **Subtask:** Checklist item inside a task.
9. **Sprint:** Fixed time period (e.g. 2 weeks) for task execution.
10. **Sprint Item:** Association mapping tasks to sprints with target status and order index.
11. **Board & Column:** Custom workflow column configuration and WIP limits.
12. **Label:** Categorization tag attached to tasks.
13. **Comment:** Polymorphic text discussion thread.
14. **Activity Log:** Audit trail capturing attribute change diffs.

---

## 2. PostgreSQL DDL Schema

```sql
-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    password_hash TEXT,
    auth_provider VARCHAR(50) DEFAULT 'local',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Workspaces Table
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    org_id VARCHAR(255),
    owner_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Workspace Members Table
CREATE TYPE user_role AS ENUM ('admin', 'lead', 'member');

CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    capacity_hours_per_week NUMERIC(5,2) DEFAULT 40.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- 4. Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    key VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, key)
);

-- 5. Epics Table
CREATE TABLE epics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    goal TEXT,
    color VARCHAR(20) DEFAULT '#3B82F6',
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Stories Table
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    epic_id UUID REFERENCES epics(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    story_points INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tasks Table
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    estimate_hours NUMERIC(5,2) DEFAULT 0,
    priority task_priority DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'backlog',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Subtasks Table
CREATE TABLE subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    is_done BOOLEAN DEFAULT FALSE,
    order_index INT DEFAULT 0
);

-- 9. Sprints Table
CREATE TYPE sprint_status AS ENUM ('planning', 'active', 'closed');

CREATE TABLE sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    goal TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status sprint_status DEFAULT 'planning',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Sprint Items Table
CREATE TABLE sprint_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id UUID REFERENCES sprints(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    order_index INT DEFAULT 0,
    UNIQUE(sprint_id, task_id)
);

-- 11. Boards & Columns
CREATE TABLE boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE board_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    order_index INT NOT NULL,
    wip_limit INT DEFAULT 0
);

-- 12. Labels Table
CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL
);

CREATE TABLE task_labels (
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

-- 13. Polymorphic Comments
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'task', 'story', 'epic'
    entity_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Activity Log
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    diff_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Firebase Firestore Document Collections Structure

Firestore uses document-oriented storage with root-level collections and subcollections:

```
/users/{userId}
  - name: string
  - email: string
  - avatarUrl: string
  - createdAt: timestamp

/workspaces/{workspaceId}
  - name: string
  - slug: string
  - ownerId: string
  - createdAt: timestamp
  
  /members/{memberId}  (Subcollection)
    - userId: string
    - role: "admin" | "lead" | "member"
    - capacityHoursPerWeek: number

/projects/{projectId}
  - workspaceId: string
  - key: string
  - name: string
  - description: string

  /epics/{epicId} (Subcollection)
    - title: string
    - goal: string
    - color: string
    - status: string

  /stories/{storyId} (Subcollection)
    - epicId: string
    - title: string
    - storyPoints: number

  /tasks/{taskId} (Subcollection or root collection indexed by projectId)
    - storyId: string
    - title: string
    - description: string
    - assigneeId: string
    - estimateHours: number
    - priority: "low" | "medium" | "high" | "urgent"
    - status: string
    - version: number
    - subtasks: array of { id, title, isDone, orderIndex }
    - labelIds: array of string
    - updatedAt: timestamp

  /sprints/{sprintId} (Subcollection)
    - name: string
    - goal: string
    - startDate: timestamp
    - endDate: timestamp
    - status: "planning" | "active" | "closed"
    - items: array of { taskId, status, orderIndex }

/comments/{commentId}
  - entityType: "task" | "story" | "epic"
  - entityId: string
  - userId: string
  - body: string
  - createdAt: timestamp

/activityLogs/{logId}
  - entityType: string
  - entityId: string
  - userId: string
  - action: string
  - diffJson: map
  - createdAt: timestamp
```

### Firestore Composite Indexes Required
1. `tasks` collection: `projectId` ASC, `status` ASC, `updatedAt` DESC
2. `sprints` collection: `projectId` ASC, `status` ASC, `startDate` DESC
3. `comments` collection: `entityId` ASC, `createdAt` ASC

---

## 4. In-Memory Storage Driver Data Structure

The In-Memory driver maintains thread-safe JavaScript `Map` objects in process memory:

```typescript
export class InMemoryDataStore {
  public users = new Map<string, UserEntity>();
  public workspaces = new Map<string, WorkspaceEntity>();
  public workspaceMembers = new Map<string, WorkspaceMemberEntity>(); // key: workspaceId:userId
  public projects = new Map<string, ProjectEntity>();
  public epics = new Map<string, EpicEntity>();
  public stories = new Map<string, StoryEntity>();
  public tasks = new Map<string, TaskEntity>();
  public subtasks = new Map<string, SubtaskEntity>();
  public sprints = new Map<string, SprintEntity>();
  public sprintItems = new Map<string, SprintItemEntity>();
  public boards = new Map<string, BoardEntity>();
  public boardColumns = new Map<string, BoardColumnEntity>();
  public labels = new Map<string, LabelEntity>();
  public comments = new Map<string, CommentEntity>();
  public activityLogs = new Map<string, ActivityLogEntity>();

  public clear(): void {
    this.users.clear();
    this.workspaces.clear();
    this.workspaceMembers.clear();
    this.projects.clear();
    this.epics.clear();
    this.stories.clear();
    this.tasks.clear();
    this.subtasks.clear();
    this.sprints.clear();
    this.sprintItems.clear();
    this.boards.clear();
    this.boardColumns.clear();
    this.labels.clear();
    this.comments.clear();
    this.activityLogs.clear();
  }
}
```

---

## 5. Summary & Next Steps

- Proceed to [03-backend-and-api-specs.md](file:///c:/Users/ayush/Pictures/kanban/docs/03-backend-and-api-specs.md) to inspect the Repository interfaces and REST API contracts.
