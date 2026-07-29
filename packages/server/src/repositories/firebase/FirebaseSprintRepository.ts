import { v4 as uuidv4 } from 'uuid';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { ISprintRepository } from '../../interfaces/repositories';
import {
  Sprint,
  CreateSprintInput,
  SprintItem,
  BurndownSnapshot,
  TaskStatus,
} from '../../types/index';

function tsToIso(val: Timestamp | string | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

function docToSprint(id: string, data: FirebaseFirestore.DocumentData): Sprint {
  return {
    id,
    projectId: data.projectId,
    name: data.name,
    goal: data.goal,
    startDate: data.startDate ? tsToIso(data.startDate) : undefined,
    endDate: data.endDate ? tsToIso(data.endDate) : undefined,
    status: data.status ?? 'planning',
    createdAt: tsToIso(data.createdAt),
  };
}

export class FirebaseSprintRepository implements ISprintRepository {
  private sprintCol: FirebaseFirestore.CollectionReference;
  private itemCol: FirebaseFirestore.CollectionReference;

  constructor(private db: Firestore) {
    this.sprintCol = db.collection('sprints');
    this.itemCol = db.collection('sprint_items');
  }

  async findById(id: string): Promise<Sprint | null> {
    const doc = await this.sprintCol.doc(id).get();
    if (!doc.exists) return null;
    return docToSprint(doc.id, doc.data()!);
  }

  async findByProject(projectId: string): Promise<Sprint[]> {
    const snap = await this.sprintCol
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => docToSprint(d.id, d.data()));
  }

  async create(input: CreateSprintInput): Promise<Sprint> {
    const id = uuidv4();
    const now = Timestamp.now();
    const data: Record<string, unknown> = {
      projectId: input.projectId,
      name: input.name,
      goal: input.goal ?? '',
      status: 'planning',
      createdAt: now,
    };
    if (input.startDate) {
      data.startDate = Timestamp.fromDate(new Date(input.startDate));
    }
    if (input.endDate) {
      data.endDate = Timestamp.fromDate(new Date(input.endDate));
    }
    await this.sprintCol.doc(id).set(data);
    return docToSprint(id, data);
  }

  async updateStatus(
    id: string,
    status: 'planning' | 'active' | 'closed'
  ): Promise<Sprint> {
    await this.sprintCol.doc(id).update({ status });
    const doc = await this.sprintCol.doc(id).get();
    return docToSprint(doc.id, doc.data()!);
  }

  async addItems(sprintId: string, taskIds: string[]): Promise<SprintItem[]> {
    const existing = await this.itemCol
      .where('sprintId', '==', sprintId)
      .get();
    const existingTaskIds = new Set(
      existing.docs.map((d) => d.data().taskId as string)
    );

    const batch = this.db.batch();
    const newItems: SprintItem[] = [];
    let orderBase = existing.size;

    for (const taskId of taskIds) {
      if (existingTaskIds.has(taskId)) continue;
      const id = uuidv4();
      const item: Omit<SprintItem, 'id'> = {
        sprintId,
        taskId,
        status: 'todo',
        orderIndex: orderBase++,
      };
      batch.set(this.itemCol.doc(id), item);
      newItems.push({ id, ...item });
    }

    await batch.commit();
    return newItems;
  }

  async removeItem(sprintId: string, taskId: string): Promise<boolean> {
    const snap = await this.itemCol
      .where('sprintId', '==', sprintId)
      .where('taskId', '==', taskId)
      .get();
    const batch = this.db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return !snap.empty;
  }

  async getItems(sprintId: string): Promise<SprintItem[]> {
    const snap = await this.itemCol
      .where('sprintId', '==', sprintId)
      .orderBy('orderIndex')
      .get();
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SprintItem, 'id'>),
    }));
  }

  async updateItemOrder(
    sprintId: string,
    itemOrders: { taskId: string; orderIndex: number; status: string }[]
  ): Promise<void> {
    const snap = await this.itemCol
      .where('sprintId', '==', sprintId)
      .get();

    const docMap = new Map<string, string>();
    snap.docs.forEach((d) => docMap.set(d.data().taskId as string, d.id));

    const batch = this.db.batch();
    for (const item of itemOrders) {
      const docId = docMap.get(item.taskId);
      if (docId) {
        batch.update(this.itemCol.doc(docId), {
          orderIndex: item.orderIndex,
          status: item.status,
        });
      }
    }
    await batch.commit();
  }

  async getBurndownData(sprintId: string): Promise<BurndownSnapshot[]> {
    const sprint = await this.findById(sprintId);
    if (!sprint || !sprint.startDate || !sprint.endDate) return [];

    const items = await this.getItems(sprintId);
    const taskIds = items.map((i) => i.taskId);
    if (taskIds.length === 0) return [];

    // Fetch task estimate hours
    const taskSnaps = await Promise.all(
      taskIds.map((id) => this.db.collection('tasks').doc(id).get())
    );
    const totalPoints = taskSnaps.reduce((sum, d) => {
      return sum + (d.exists ? (d.data()?.estimateHours ?? 0) : 0);
    }, 0);

    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const msPerDay = 86400000;
    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / msPerDay
    );

    const snapshots: BurndownSnapshot[] = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(start.getTime() + i * msPerDay)
        .toISOString()
        .split('T')[0];
      const idealRemaining =
        totalPoints - (totalPoints / totalDays) * i;
      // For real burndown, this would join with actual completion data
      // Here we use sprint items status as a proxy
      const completed = items.filter((it) => it.status === 'done').length;
      const completedPoints =
        i === totalDays
          ? taskSnaps
              .filter((_, idx) => items[idx]?.status === 'done')
              .reduce((s, d) => s + (d.data()?.estimateHours ?? 0), 0)
          : 0;

      snapshots.push({
        date,
        remainingPoints: Math.max(0, totalPoints - completedPoints),
        idealPoints: Math.max(0, idealRemaining),
        completedPoints,
      });
    }

    return snapshots;
  }
}
