import { v4 as uuidv4 } from 'uuid';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { IStoryRepository } from '../../interfaces/repositories';
import { Story } from '../../types/index';

function tsToIso(val: Timestamp | string | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export class FirebaseStoryRepository implements IStoryRepository {
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<Story | null> {
    const doc = await this.db.collection('stories').doc(id).get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    return {
      id: doc.id,
      epicId: d.epicId,
      projectId: d.projectId,
      title: d.title,
      description: d.description,
      storyPoints: d.storyPoints ?? 0,
      priority: d.priority ?? 'medium',
      createdAt: tsToIso(d.createdAt),
    };
  }

  async findByProject(projectId: string): Promise<Story[]> {
    const snap = await this.db
      .collection('stories')
      .where('projectId', '==', projectId)
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        epicId: data.epicId,
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        storyPoints: data.storyPoints ?? 0,
        priority: data.priority ?? 'medium',
        createdAt: tsToIso(data.createdAt),
      };
    });
  }

  async findByEpic(epicId: string): Promise<Story[]> {
    const snap = await this.db
      .collection('stories')
      .where('epicId', '==', epicId)
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        epicId: data.epicId,
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        storyPoints: data.storyPoints ?? 0,
        priority: data.priority ?? 'medium',
        createdAt: tsToIso(data.createdAt),
      };
    });
  }

  async create(input: Omit<Story, 'id' | 'createdAt'>): Promise<Story> {
    const id = uuidv4();
    const now = Timestamp.now();
    const data = {
      epicId: input.epicId ?? null,
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? '',
      storyPoints: input.storyPoints ?? 0,
      priority: input.priority ?? 'medium',
      createdAt: now,
    };
    await this.db.collection('stories').doc(id).set(data);
    return {
      id,
      ...input,
      createdAt: now.toDate().toISOString(),
    };
  }

  async update(id: string, changes: Partial<Story>): Promise<Story> {
    const docRef = this.db.collection('stories').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error('Story not found');
    await docRef.update(changes);
    const updatedDoc = await docRef.get();
    const d = updatedDoc.data()!;
    return {
      id: updatedDoc.id,
      epicId: d.epicId,
      projectId: d.projectId,
      title: d.title,
      description: d.description,
      storyPoints: d.storyPoints ?? 0,
      priority: d.priority ?? 'medium',
      createdAt: tsToIso(d.createdAt),
    };
  }

  async delete(id: string): Promise<boolean> {
    await this.db.collection('stories').doc(id).delete();
    return true;
  }
}
