import { v4 as uuidv4 } from 'uuid';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { ITaskRepository } from '../../interfaces/repositories';
import {
  Task,
  CreateTaskInput,
  Subtask,
  CreateSubtaskInput,
} from '../../types/index';

function tsToIso(
  val: Timestamp | string | undefined
): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

function docToTask(id: string, data: FirebaseFirestore.DocumentData): Task {
  return {
    id,
    projectId: data.projectId,
    storyId: data.storyId,
    assigneeId: data.assigneeId,
    title: data.title,
    description: data.description,
    estimateHours: data.estimateHours ?? 0,
    priority: data.priority ?? 'medium',
    status: data.status ?? 'backlog',
    labelIds: data.labelIds ?? [],
    version: data.version ?? 1,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

export class FirebaseTaskRepository implements ITaskRepository {
  private col: FirebaseFirestore.CollectionReference;
  private subCol: FirebaseFirestore.CollectionReference;

  constructor(private db: Firestore) {
    this.col = db.collection('tasks');
    this.subCol = db.collection('subtasks');
  }

  async findById(id: string): Promise<Task | null> {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) return null;
    return docToTask(doc.id, doc.data()!);
  }

  async findByProject(
    projectId: string,
    filter?: { status?: string; assigneeId?: string }
  ): Promise<Task[]> {
    let query: FirebaseFirestore.Query = this.col.where(
      'projectId',
      '==',
      projectId
    );
    if (filter?.status) {
      query = query.where('status', '==', filter.status);
    }
    if (filter?.assigneeId) {
      query = query.where('assigneeId', '==', filter.assigneeId);
    }
    const snap = await query.get();
    return snap.docs.map((d) => docToTask(d.id, d.data()));
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const id = uuidv4();
    const now = Timestamp.now();
    const data = {
      projectId: input.projectId,
      storyId: input.storyId ?? null,
      assigneeId: input.assigneeId ?? null,
      title: input.title,
      description: input.description ?? '',
      estimateHours: input.estimateHours ?? 0,
      priority: input.priority ?? 'medium',
      status: input.status ?? 'backlog',
      labelIds: input.labelIds ?? [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.col.doc(id).set(data);
    return docToTask(id, data);
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: Partial<Task>
  ): Promise<Task> {
    const ref = this.col.doc(id);

    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) {
        throw Object.assign(new Error('Task not found'), { code: 404 });
      }
      const current = doc.data()!;
      if (current.version !== expectedVersion) {
        throw Object.assign(
          new Error(
            `VERSION_MISMATCH: expected ${expectedVersion}, current is ${current.version}`
          ),
          { code: 409, currentVersion: current.version }
        );
      }
      const updated = {
        ...changes,
        version: expectedVersion + 1,
        updatedAt: Timestamp.now(),
      };
      tx.update(ref, updated);
      return docToTask(id, { ...current, ...updated });
    });
  }

  async delete(id: string): Promise<boolean> {
    await this.col.doc(id).delete();
    return true;
  }

  async addSubtask(
    taskId: string,
    input: CreateSubtaskInput
  ): Promise<Subtask> {
    const id = uuidv4();
    // Count existing to set orderIndex
    const existing = await this.subCol
      .where('taskId', '==', taskId)
      .get();
    const subtask: Omit<Subtask, 'id'> = {
      taskId,
      title: input.title,
      isDone: false,
      orderIndex: existing.size,
    };
    await this.subCol.doc(id).set(subtask);
    return { id, ...subtask };
  }

  async getSubtasks(taskId: string): Promise<Subtask[]> {
    const snap = await this.subCol
      .where('taskId', '==', taskId)
      .orderBy('orderIndex')
      .get();
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Subtask, 'id'>),
    }));
  }

  async toggleSubtask(subtaskId: string, isDone: boolean): Promise<Subtask> {
    const ref = this.subCol.doc(subtaskId);
    await ref.update({ isDone });
    const doc = await ref.get();
    return { id: doc.id, ...(doc.data() as Omit<Subtask, 'id'>) };
  }
}
