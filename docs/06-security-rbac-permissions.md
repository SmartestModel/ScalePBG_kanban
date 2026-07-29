# 06. Security & RBAC Permissions

This document defines the server-enforced Role-Based Access Control (RBAC) matrix, authorization middleware, SQL policies, and production-grade Firestore Security Rules.

---

## 1. Role-Based Access Control (RBAC) Matrix

Permissions are assigned based on a user's role within a workspace (`admin`, `lead`, or `member`):

| Action Category | Specific Action | Admin | Lead | Member |
|---|---|---|---|---|
| **Workspace** | Update Workspace Settings / Invite Members | ✅ | ❌ | ❌ |
| **Projects** | Create / Archive Projects | ✅ | ❌ | ❌ |
| **Sprints** | Create Sprint / Close Sprint | ✅ | ✅ | ❌ |
| **Sprints** | Drag items from Backlog into Sprint | ✅ | ✅ | ❌ |
| **Tasks** | Create Backlog Task / Story | ✅ | ✅ | ✅ |
| **Tasks** | Assign Task to any Member | ✅ | ✅ | ❌ (Self-assign only) |
| **Tasks** | Edit any Task fields | ✅ | ✅ | Assigned Tasks only |
| **Tasks** | Update Task status on Sprint Board | ✅ | ✅ | ✅ |
| **Metrics** | View Team Velocity & Workload Metrics | ✅ | ✅ | ❌ |

---

## 2. Server-Side Policy Engine (`can` helper)

Regardless of storage backend, all write endpoints evaluate authorization using a centralized policy checker:

```typescript
export type UserRole = 'admin' | 'lead' | 'member';

export interface UserContext {
  id: string;
  role: UserRole;
}

export type Action =
  | 'project:create'
  | 'sprint:create'
  | 'sprint:close'
  | 'task:assign'
  | 'task:edit'
  | 'metrics:view';

export function can(user: UserContext, action: Action, resourceOwnerId?: string): boolean {
  switch (action) {
    case 'project:create':
      return user.role === 'admin';

    case 'sprint:create':
    case 'sprint:close':
    case 'metrics:view':
      return user.role === 'admin' || user.role === 'lead';

    case 'task:assign':
      return user.role === 'admin' || user.role === 'lead';

    case 'task:edit':
      if (user.role === 'admin' || user.role === 'lead') return true;
      // Members can only edit tasks assigned to themselves
      return resourceOwnerId !== undefined && user.id === resourceOwnerId;

    default:
      return false;
  }
}
```

---

## 3. Firebase Firestore Security Rules (`firestore.rules`)

When deploying using the Firebase Storage Driver, authorization rules are declared in `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check authentication
    function isAuthenticated() {
      return request.auth != null;
    }

    // Fetch user workspace role
    function getWorkspaceRole(workspaceId) {
      return get(/databases/$(database)/documents/workspaces/$(workspaceId)/members/$(request.auth.uid)).data.role;
    }

    function isAdmin(workspaceId) {
      return isAuthenticated() && getWorkspaceRole(workspaceId) == 'admin';
    }

    function isLeadOrAdmin(workspaceId) {
      return isAuthenticated() && (getWorkspaceRole(workspaceId) == 'admin' || getWorkspaceRole(workspaceId) == 'lead');
    }

    // Workspaces
    match /workspaces/{workspaceId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin(workspaceId);

      match /members/{memberId} {
        allow read: if isAuthenticated();
        allow write: if isAdmin(workspaceId);
      }
    }

    // Tasks Collection
    match /tasks/{taskId} {
      allow read: if isAuthenticated();
      
      // Admin and Lead can create/update any task
      // Members can create tasks or update tasks assigned to them
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && (
        isLeadOrAdmin(resource.data.workspaceId) ||
        resource.data.assigneeId == request.auth.uid
      );
      allow delete: if isLeadOrAdmin(resource.data.workspaceId);
    }

    // Sprints Collection
    match /sprints/{sprintId} {
      allow read: if isAuthenticated();
      allow write: if isLeadOrAdmin(resource.data.workspaceId);
    }
  }
}
```

---

## 4. PostgreSQL Row-Level Security (RLS)

For the PostgreSQL driver, tenant isolation and workspace membership check can be enforced at the SQL session level:

```sql
-- Enable RLS on tasks table
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read tasks in workspaces they belong to
CREATE POLICY task_workspace_member_select ON tasks
    FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
            WHERE wm.user_id = current_setting('app.current_user_id')::UUID
        )
    );
```

---

## 5. Next Steps

- Proceed to [07-deployment-and-ci-cd.md](file:///c:/Users/ayush/Pictures/kanban/docs/07-deployment-and-ci-cd.md) to inspect deployment procedures.
