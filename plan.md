# Team Kanban & Sprint Management Platform — Master Architecture & Plan

## 1. Executive Product Overview

**What it is:** An enterprise-grade internal team platform combining Kanban task management, weekly sprint planning, epic/backlog roadmap tracking, and role-based views (Admin / Lead / Member) with real-time sync, performance metrics, and configurable storage backends.

**Core Design Principles:**
1. **Unified Domain Model:** Single source of truth (`Workspace → Project → Epic → Story → Task → Subtask`) serving three lenses:
   - **Backlog / Roadmap Lens:** High-level strategic planning across releases and epics.
   - **Sprint Board Lens:** Tactical execution, velocity, and drag-and-drop task movement.
   - **Admin / Team Lens:** Workload analysis, burndown metrics, capacity planning, and auditing.
2. **Pluggable Storage Infrastructure:** Abstract Repository Layer (`ITaskRepository`, `IWorkspaceRepository`, etc.) supporting three plug-and-play persistence drivers:
   - **PostgreSQL Driver:** Full ACID relational database with SQL migrations and indexing.
   - **Firebase Firestore Driver:** NoSQL document database with real-time listeners and cloud scalability.
   - **In-Memory Driver:** Zero-dependency, fast mock engine for local testing, rapid development, and offline preview.
3. **Flexible Multi-Cloud Deployment:** Clean separation between static frontend assets and API logic, allowing deployment via **Firebase (Hosting + Cloud Functions)**, **Node.js (Fastify/Express on Railway/Render)**, or **Standalone SPA**.

---

## 2. Documentation Index (`docs/`)

Detailed design specifications, schema definitions, and implementation guides are organized in the [docs](file:///c:/Users/ayush/Pictures/kanban/docs) directory:

| Document | Description |
|---|---|
| 📄 [01-architecture-overview.md](file:///c:/Users/ayush/Pictures/kanban/docs/01-architecture-overview.md) | High-level system topology, decoupled layers, repository interfaces, driver factory patterns, and deployment models. |
| 📄 [02-data-models-and-storage.md](file:///c:/Users/ayush/Pictures/kanban/docs/02-data-models-and-storage.md) | Complete 14-entity schema specifications for PostgreSQL SQL DDL, Firebase Firestore Document Collections, and In-Memory Data Structures. |
| 📄 [03-backend-and-api-specs.md](file:///c:/Users/ayush/Pictures/kanban/docs/03-backend-and-api-specs.md) | REST & WebSocket API specification, Repository interface definitions (`ITaskRepository`, `ISprintRepository`, etc.), optimistic locking logic. |
| 📄 [04-firebase-and-memory-adapters.md](file:///c:/Users/ayush/Pictures/kanban/docs/04-firebase-and-memory-adapters.md) | In-Memory data adapter implementation, Firestore data conversion, Firebase Auth integration, and Cloud Functions API wrappers. |
| 📄 [05-frontend-architecture.md](file:///c:/Users/ayush/Pictures/kanban/docs/05-frontend-architecture.md) | React + TypeScript SPA, Zustand state management, `dnd-kit` drag-and-drop mechanics, Recharts reporting, and client-side storage switches. |
| 📄 [06-security-rbac-permissions.md](file:///c:/Users/ayush/Pictures/kanban/docs/06-security-rbac-permissions.md) | Role-Based Access Control matrix (Admin/Lead/Member), server-side middleware, and production-ready Firestore Security Rules. |
| 📄 [07-deployment-and-ci-cd.md](file:///c:/Users/ayush/Pictures/kanban/docs/07-deployment-and-ci-cd.md) | Deployment runbooks for Firebase (Hosting + Functions), Node.js containers (Railway/Vercel), and local In-Memory dev servers. |

---

## 3. Entity & Relational Architecture

```
Organization
 └─ Workspace (team domain)
     ├─ Members (user_id, role: admin|lead|member, capacity_hours_per_week)
     ├─ Project
     │   ├─ Epic
     │   │   └─ Story
     │   │       └─ Task
     │   │           └─ Subtask
     │   ├─ Backlog (ordered stories/tasks unassigned to active sprint)
     │   ├─ Sprint (start_date, end_date, goal, status: planning|active|closed)
     │   │   └─ Sprint Items (task_id, assignee, estimate_hrs, status, order_index)
     │   ├─ Board (columns, WIP limits)
     │   └─ Release (groups Epics/Sprints)
     ├─ Labels / Tags (workspace-wide or project-specific)
     ├─ Comments (polymorphic attached to Task/Story/Epic)
     ├─ Attachments (polymorphic S3 / Firebase Storage references)
     ├─ Activity Log (audit log with polymorphic diffs)
     └─ Notifications (in-app & email digests)
```

### Relational Table / Document Collection Summary

| Entity | Primary Key | Key Attributes / Fields |
|---|---|---|
| `users` | `id` | name, email, avatar_url, auth_provider, password_hash |
| `workspaces` | `id` | name, org_id, owner_id, created_at |
| `workspace_members` | `id` | workspace_id, user_id, role (admin/lead/member), capacity_hrs |
| `projects` | `id` | workspace_id, key (e.g. "KAN"), name, description |
| `epics` | `id` | project_id, title, goal, color, status |
| `stories` | `id` | epic_id, title, description, story_points, priority |
| `tasks` | `id` | story_id, title, assignee_id, estimate_hrs, priority, status, version |
| `subtasks` | `id` | task_id, title, is_done, order_index |
| `sprints` | `id` | project_id, name, start_date, end_date, goal, status |
| `sprint_items` | `id` | sprint_id, task_id, status, order_index |
| `boards` | `id` | project_id, sprint_id (nullable), name |
| `board_columns` | `id` | board_id, name, order_index, wip_limit |
| `labels` | `id` | workspace_id, name, color |
| `comments` | `id` | entity_type, entity_id, user_id, body, created_at |
| `attachments` | `id` | entity_type, entity_id, file_name, file_url, size_bytes |
| `activity_log` | `id` | entity_type, entity_id, user_id, action, diff_json |

---

## 4. Storage Driver Abstraction

The platform uses a clean **Repository Pattern** to decouple application logic from storage implementation:

```
                  ┌────────────────────────┐
                  │    Service Layer       │
                  │ (Sprint/Task/Workspaces)│
                  └───────────┬────────────┘
                              │
                  ┌───────────▼────────────┐
                  │  Repository Interfaces │
                  │(ITaskRepo, ISprintRepo)│
                  └───────────┬────────────┘
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼───────┐   ┌────────▼───────┐   ┌────────▼───────┐
│ Postgres Driver│   │ Firebase Driver│   │ Memory Driver  │
│ (Prisma / SQL) │   │  (Firestore)   │   │  (JS Map Store)│
└────────────────┘   └────────────────┘   └────────────────┘
```

Configured dynamically via environment configuration:
- `STORAGE_DRIVER=postgres` -> Connects to PostgreSQL database via pool/ORM.
- `STORAGE_DRIVER=firebase` -> Connects to Firebase Admin SDK / Firestore collections.
- `STORAGE_DRIVER=memory` -> Loads thread-safe in-memory map repository seeded with mock data.

---

## 5. Deployment Options

### Strategy A: Firebase Serverless Deployment (No Infra Maintenance)
- **Frontend:** Deployed to **Firebase Hosting** (global CDN).
- **Backend API:** Express/Fastify app wrapped into **Firebase Cloud Functions** (HTTP trigger).
- **Database:** **Firebase Firestore** NoSQL database with real-time snapshots.
- **Authentication:** **Firebase Authentication** (Google SSO, Email/Password).
- **Storage:** **Firebase Storage** for task attachments.

### Strategy B: Containerized Node + PostgreSQL Deployment (High Performance)
- **Frontend:** Deployed on **Vercel** or static CDN.
- **Backend API:** Node.js Fastify web server on **Railway**, **Render**, or **AWS ECS**.
- **Database:** Managed **PostgreSQL** (Railway Postgres, AWS RDS, Neon).
- **Cache & Real-Time:** **Redis** for Pub/Sub and BullMQ background jobs.
- **Authentication:** Custom JWT with access & refresh token rotation.

### Strategy C: Standalone Local / Offline Memory Mode (Dev & Testing)
- **Frontend & API:** Combined Vite dev server with in-process mock API using the **In-Memory Driver**.
- **Use Case:** Zero-install developer onboarding, automated end-to-end testing, offline demos.

---

## 6. Phased Implementation Roadmap

### Phase 1: Foundation & Storage Adapters (Weeks 1–3)
- Define repository contracts (`ITaskRepository`, `IWorkspaceRepository`, `ISprintRepository`, `IAuthService`).
- Implement `MemoryRepository` and test harness.
- Implement `PostgresRepository` (SQL migrations, connection pool).
- Implement `FirebaseRepository` (Firestore schemas and queries).
- Setup dynamic driver initialization factory.

### Phase 2: Core Task & Board Functionality (Weeks 4–6)
- Project, Backlog, Epic, and Story management APIs.
- Sprint planning lifecycle (Create, Add Items, Capacity Checks, Start, Close).
- Kanban board drag-and-drop mechanics with optimistic concurrency locking (`version` field).
- Frontend board rendering with `dnd-kit` and Zustand.

### Phase 3: Real-Time & Security (Weeks 7–8)
- Real-time event driver (Socket.io for Postgres/Memory, Firestore Snapshots for Firebase).
- RBAC permission engine (Admin, Lead, Member) with server middleware and Firestore Security Rules.
- Comments, file attachments, and activity logging.

### Phase 4: Analytics, Metrics & Deployment (Weeks 9–10)
- Burndown charts, velocity tracking, and workload reporting.
- CI/CD build scripts for Firebase deployment and Docker containerization.
- Complete automated end-to-end testing across all three storage backends.

---

## 7. Next Steps

1. Explore the detailed sub-documents in the [`docs/`](file:///c:/Users/ayush/Pictures/kanban/docs) folder.
2. Select your desired initial storage driver (`STORAGE_DRIVER=memory|firebase|postgres`) in environment settings.
3. Scaffold the workspace repository implementation following [03-backend-and-api-specs.md](file:///c:/Users/ayush/Pictures/kanban/docs/03-backend-and-api-specs.md).