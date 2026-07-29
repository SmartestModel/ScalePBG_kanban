# 04. Firebase & In-Memory Storage Adapters Implementation Guide

This document details the concrete implementation patterns for the **In-Memory** and **Firebase Firestore** storage drivers, demonstrating how they satisfy the abstract repository contracts.

---

## 1. In-Memory Storage Adapter

The In-Memory adapter is designed for rapid development, automated unit testing, and standalone offline execution.

### Implementation Blueprint (`MemoryTaskRepository.ts`)

```typescript
import { ITaskRepository, Task, CreateTaskInput, Subtask } from '../interfaces';
import { InMemoryDataStore } from '../store/InMemoryDataStore';

export class MemoryTaskRepository implements ITaskRepository {
  constructor(private store: InMemoryDataStore) {}

  async findById(id: string): Promise<Task | null> {
    const task = this.store.tasks.get(id);
    return task ? { ...task } : null;
  }

  async findByProject(projectId: string): Promise<Task[]> {
    return Array.from(this.store.tasks.values())
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ ...t }));
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newTask: Task = {
      id,
      ...input,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.tasks.set(id, newTask);
    return { ...newTask };
  }

  async updateWithVersion(id: string, expectedVersion: number, changes: Partial<Task>): Promise<Task> {
    const existing = this.store.tasks.get(id);
    if (!existing) {
      throw new Error(`Task with ID ${id} not found.`);
    }

    if (existing.version !== expectedVersion) {
      throw new Error(`VERSION_MISMATCH: expected ${expectedVersion}, found ${existing.version}`);
    }

    const updated: Task = {
      ...existing,
      ...changes,
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    };

    this.store.tasks.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.store.tasks.delete(id);
  }

  async addSubtask(taskId: string, input: { title: string }): Promise<Subtask> {
    const subtaskId = `sub-${Date.now()}`;
    const subtask: Subtask = {
      id: subtaskId,
      taskId,
      title: input.title,
      isDone: false,
      orderIndex: 0,
    };
    this.store.subtasks.set(subtaskId, subtask);
    return subtask;
  }

  async toggleSubtask(subtaskId: string, isDone: boolean): Promise<Subtask> {
    const sub = this.store.subtasks.get(subtaskId);
    if (!sub) throw new Error('Subtask not found');
    sub.isDone = isDone;
    this.store.subtasks.set(subtaskId, sub);
    return { ...sub };
  }
}
```

### Seed Data Generator (`seedMemoryStore.ts`)
The In-Memory driver includes an auto-seeder to populate default workspaces, users, projects, and sprint items when running locally:

```typescript
export function seedMemoryStore(store: InMemoryDataStore): void {
  store.clear();

  // 1. Users
  store.users.set('usr-1', { id: 'usr-1', name: 'Alice Admin', email: 'alice@company.com' });
  store.users.set('usr-2', { id: 'usr-2', name: 'Bob Lead', email: 'bob@company.com' });

  // 2. Workspace
  store.workspaces.set('ws-1', { id: 'ws-1', name: 'Product Engineering', slug: 'eng' });

  // 3. Project
  store.projects.set('proj-1', { id: 'proj-1', workspaceId: 'ws-1', key: 'KAN', name: 'Kanban Platform' });

  // 4. Sample Tasks
  store.tasks.set('task-1', {
    id: 'task-1',
    projectId: 'proj-1',
    title: 'Setup repository pattern adapters',
    status: 'in_progress',
    version: 1,
    assigneeId: 'usr-2',
    estimateHours: 8,
    createdAt: new Date().toISOString(),
  });
}
```

---

## 2. Firebase Firestore Storage Adapter

The Firebase adapter translates repository interface calls into **Google Cloud Firestore** queries and batch writes.

### Firestore Task Repository Implementation (`FirebaseTaskRepository.ts`)

```typescript
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ITaskRepository, Task, CreateTaskInput } from '../interfaces';

export class FirebaseTaskRepository implements ITaskRepository {
  private db = getFirestore();

  async findById(id: string): Promise<Task | null> {
    const doc = await this.db.collection('tasks').doc(id).get();
    if (!doc.exists) return null;
    return this.mapDocToTask(doc.id, doc.data()!);
  }

  async findByProject(projectId: string): Promise<Task[]> {
    const snapshot = await this.db.collection('tasks')
      .where('projectId', '==', projectId)
      .get();
    
    return snapshot.docs.map((doc) => this.mapDocToTask(doc.id, doc.data()));
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const ref = this.db.collection('tasks').doc();
    const data = {
      ...input,
      version: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await ref.set(data);
    return { id: ref.id, ...input, version: 1, createdAt: new Date().toISOString() };
  }

  async updateWithVersion(id: string, expectedVersion: number, changes: Partial<Task>): Promise<Task> {
    const ref = this.db.collection('tasks').doc(id);

    return await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) {
        throw new Error(`Task ${id} does not exist.`);
      }

      const currentData = doc.data()!;
      if (currentData.version !== expectedVersion) {
        throw new Error(`VERSION_MISMATCH: Current version is ${currentData.version}, expected ${expectedVersion}`);
      }

      const updatedVersion = expectedVersion + 1;
      const payload = {
        ...changes,
        version: updatedVersion,
        updatedAt: Timestamp.now(),
      };

      transaction.update(ref, payload);
      return { id, ...currentData, ...changes, version: updatedVersion };
    });
  }

  private mapDocToTask(id: string, data: Record<string, any>): Task {
    return {
      id,
      projectId: data.projectId,
      storyId: data.storyId,
      assigneeId: data.assigneeId,
      title: data.title,
      description: data.description,
      estimateHours: data.estimateHours,
      priority: data.priority,
      status: data.status,
      version: data.version || 1,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  }
}
```

---

## 3. Firebase Cloud Functions Entry Point (`index.ts`)

When deployed to Firebase, the API is exposed as HTTP Cloud Functions:

```typescript
import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import { createRepositoryFactory } from './factory';
import { buildTaskRouter } from './routers/taskRouter';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize Repository Drivers (configured via environment variable or default to 'firebase')
const driver = (process.env.STORAGE_DRIVER as any) || 'firebase';
const factory = createRepositoryFactory(driver);

app.use('/tasks', buildTaskRouter(factory.getTaskRepository()));

export const api = functions.https.onRequest(app);
```

---

## 4. Frontend Realtime Adapter (Firestore vs Socket.io)

On the client side, real-time snapshot subscription is managed through an abstract listener:

```typescript
export interface IRealtimeSubscription {
  subscribeToBoard(sprintId: string, onUpdate: (items: any[]) => void): () => void;
}

// Firestore Implementation for Client
export class FirestoreRealtimeClient implements IRealtimeSubscription {
  subscribeToBoard(sprintId: string, onUpdate: (items: any[]) => void) {
    const q = query(collection(db, 'sprint_items'), where('sprintId', '==', sprintId));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onUpdate(items);
    });
  }
}
```

---

## 5. Next Steps

- Proceed to [05-frontend-architecture.md](file:///c:/Users/ayush/Pictures/kanban/docs/05-frontend-architecture.md) to inspect the client application design.
