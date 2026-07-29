# 05. Frontend Architecture & Design System

This document outlines the React + TypeScript single-page application structure, state management architecture, `dnd-kit` drag-and-drop board integration, and aesthetic styling guidelines.

---

## 1. Technology Stack & Component Structure

- **Framework:** React 18+ with TypeScript & Vite build system.
- **State Management:** **Zustand** for local board & UI state; **TanStack React Query** for server state.
- **Drag-and-Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- **Data Visualization:** **Recharts** (Burndown line charts, velocity bar charts, capacity gauges).
- **Icons & Typography:** Lucide React icons, Inter / Outfit Google Fonts.
- **Styling:** Vanilla CSS with scoped Design Tokens (CSS Variables).

---

## 2. Directory Layout Architecture

```
src/
├── assets/                  # Logos, badges, fallback illustrations
├── components/
│   ├── common/              # Buttons, Modals, Badges, Avatar, Tooltip
│   ├── kanban/
│   │   ├── Board.tsx        # Drag-and-drop context container
│   │   ├── Column.tsx       # Droppable column target with WIP counter
│   │   ├── TaskCard.tsx     # Sortable drag item with optimistic lock badge
│   │   └── CardDetailModal.tsx # Task editor, comments, subtasks
│   ├── sprint/
│   │   ├── SprintPlanner.tsx # Backlog to Sprint drag transfer workspace
│   │   └── BurndownChart.tsx# Recharts burndown renderer
│   └── views/
│       ├── AdminDashboard.tsx # Metrics, workload, velocity reports
│       ├── LeadWorkspace.tsx  # Sprint planning, capacity warnings
│       └── MemberView.tsx     # Filtered "My Tasks" board
├── hooks/                   # Custom hooks (useDragAndDrop, useRealtimeSync)
├── services/                # API client adapters (Axios/Fetch + Firebase SDK bridge)
├── store/
│   ├── useBoardStore.ts     # Zustand store for active board state
│   ├── useWorkspaceStore.ts # Active workspace, project, sprint context
│   └── useAuthStore.ts      # Current user session & role permissions
└── index.css                # Global CSS Design Tokens & Utilities
```

---

## 3. Design System & CSS Variables (`index.css`)

The application enforces a modern, high-contrast dark/light design system:

```css
:root {
  /* Color Palette - Tailwind-aligned HSL Tokens */
  --bg-primary: hsl(222, 47%, 11%);
  --bg-secondary: hsl(217, 33%, 17%);
  --bg-card: hsl(217, 33%, 22%);
  --bg-card-hover: hsl(217, 33%, 26%);
  
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.16);

  --text-main: hsl(210, 40%, 98%);
  --text-muted: hsl(215, 20%, 65%);

  --brand-primary: hsl(217, 91%, 60%);
  --brand-hover: hsl(217, 91%, 50%);

  --status-backlog: hsl(215, 16%, 47%);
  --status-todo: hsl(217, 91%, 60%);
  --status-in-progress: hsl(38, 92%, 50%);
  --status-in-review: hsl(270, 91%, 65%);
  --status-done: hsl(142, 71%, 45%);

  --shadow-card: 0 4px 14px 0 rgba(0, 0, 0, 0.25);
  --shadow-dragged: 0 12px 28px 0 rgba(0, 0, 0, 0.45);
}
```

---

## 4. Drag-and-Drop Optimistic State Machine (`useBoardStore.ts`)

When a user drags a task card across columns, the UI updates optimistically in local state before the API call finishes:

```typescript
import { create } from 'zustand';

interface TaskCardState {
  id: string;
  status: string;
  version: number;
  orderIndex: number;
}

interface BoardStore {
  tasks: Record<string, TaskCardState>;
  moveTask: (taskId: string, targetStatus: string, newIndex: number) => Promise<void>;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  tasks: {},
  
  moveTask: async (taskId, targetStatus, newIndex) => {
    const originalTask = get().tasks[taskId];
    if (!originalTask) return;

    // 1. Optimistic UI update
    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskId]: {
          ...originalTask,
          status: targetStatus,
          orderIndex: newIndex,
        },
      },
    }));

    try {
      // 2. Persist update to API with version check
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: originalTask.version,
          status: targetStatus,
          order_index: newIndex,
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          // Version conflict -> Revert optimistic update & refresh
          alert('Task was modified by another user. Reloading latest state.');
        }
        throw new Error('Failed to persist task move.');
      }

      const updatedData = await response.json();
      set((state) => ({
        tasks: {
          ...state.tasks,
          [taskId]: { ...updatedData },
        },
      }));
    } catch (err) {
      // 3. Rollback on network failure
      set((state) => ({
        tasks: {
          ...state.tasks,
          [taskId]: originalTask,
        },
      }));
    }
  },
}));
```

---

## 5. Role-Based Views Component Switcher

The UI dynamically adapts depending on active view props (`?view=admin`, `?view=sprint`, `?view=my-tasks`):

```typescript
export const KanbanViewContainer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('view') || 'sprint';
  const role = useAuthStore((s) => s.user?.role);

  switch (viewMode) {
    case 'admin':
      return role === 'admin' || role === 'lead' ? <AdminDashboard /> : <UnauthorizedBanner />;
    case 'lead':
      return role === 'admin' || role === 'lead' ? <SprintPlanner /> : <UnauthorizedBanner />;
    case 'my-tasks':
    case 'sprint':
    default:
      return <SprintBoard viewFilter={viewMode} />;
  }
};
```

---

## 6. Next Steps

- Proceed to [06-security-rbac-permissions.md](file:///c:/Users/ayush/Pictures/kanban/docs/06-security-rbac-permissions.md) to review authorization models.
