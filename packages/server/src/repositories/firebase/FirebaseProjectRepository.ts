import { v4 as uuidv4 } from 'uuid';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { IProjectRepository } from '../../interfaces/repositories';
import { Project, Epic, Task } from '../../types/index';

function tsToIso(
  val: Timestamp | string | undefined
): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export class FirebaseProjectRepository
  implements IProjectRepository
{
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<Project | null> {
    const doc = await this.db.collection('projects').doc(id).get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    return {
      id: doc.id,
      orgId: d.orgId,
      key: d.key,
      name: d.name,
      description: d.description,
      createdAt: tsToIso(d.createdAt),
    };
  }

  async findByOrg(orgId: string): Promise<Project[]> {
    const snap = await this.db
      .collection('projects')
      .where('orgId', '==', orgId)
      .orderBy('createdAt', 'asc')
      .get();
    return snap.docs.map((d) => ({
      id: d.id,
      orgId: d.data().orgId,
      key: d.data().key,
      name: d.data().name,
      description: d.data().description,
      createdAt: tsToIso(d.data().createdAt),
    }));
  }

  async create(
    input: Omit<Project, 'id' | 'createdAt'>
  ): Promise<Project> {
    const id = uuidv4();
    const now = Timestamp.now();
    const data = {
      orgId: input.orgId,
      key: input.key,
      name: input.name,
      description: input.description ?? '',
      createdAt: now,
    };
    await this.db.collection('projects').doc(id).set(data);
    return {
      id,
      ...input,
      createdAt: now.toDate().toISOString(),
    };
  }

  async keyExistsInOrg(
    orgId: string,
    key: string
  ): Promise<boolean> {
    const snap = await this.db
      .collection('projects')
      .where('orgId', '==', orgId)
      .where('key', '==', key)
      .get();
    return !snap.empty;
  }

  async getEpics(projectId: string): Promise<Epic[]> {
    const snap = await this.db
      .collection('epics')
      .where('projectId', '==', projectId)
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        projectId: data.projectId,
        title: data.title,
        goal: data.goal,
        color: data.color,
        status: data.status ?? 'open',
        createdAt: tsToIso(data.createdAt),
      };
    });
  }

  async createEpic(
    input: Omit<Epic, 'id' | 'createdAt'>
  ): Promise<Epic> {
    const id = uuidv4();
    const now = Timestamp.now();
    const data = {
      projectId: input.projectId,
      title: input.title,
      goal: input.goal ?? '',
      color: input.color,
      status: input.status ?? 'open',
      createdAt: now,
    };
    await this.db.collection('epics').doc(id).set(data);
    return {
      id,
      ...input,
      createdAt: now.toDate().toISOString(),
    };
  }

  async getBacklog(projectId: string): Promise<Task[]> {
    const snap = await this.db
      .collection('tasks')
      .where('projectId', '==', projectId)
      .where('status', '==', 'backlog')
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        projectId: data.projectId,
        storyId: data.storyId,
        assigneeId: data.assigneeId,
        title: data.title,
        description: data.description ?? '',
        estimateHours: data.estimateHours ?? 0,
        priority: data.priority ?? 'medium',
        status: data.status ?? 'backlog',
        labelIds: data.labelIds ?? [],
        version: data.version ?? 1,
        createdAt: tsToIso(data.createdAt),
        updatedAt: tsToIso(data.updatedAt),
      };
    });
  }
}
