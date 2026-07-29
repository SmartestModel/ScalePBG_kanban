import { v4 as uuidv4 } from 'uuid';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { ICommentRepository } from '../../interfaces/repositories';
import { Comment } from '../../types/index';

function tsToIso(val: Timestamp | string | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export class FirebaseCommentRepository implements ICommentRepository {
  private col: FirebaseFirestore.CollectionReference;

  constructor(private db: Firestore) {
    this.col = db.collection('comments');
  }

  async findByEntity(
    entityType: string,
    entityId: string
  ): Promise<Comment[]> {
    const snap = await this.col
      .where('entityType', '==', entityType)
      .where('entityId', '==', entityId)
      .orderBy('createdAt', 'asc')
      .get();

    // Enrich with user display names
    const comments = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const userDoc = await this.col.firestore
          .collection('users')
          .doc(data.userId)
          .get();
        const userData = userDoc.data();
        return {
          id: d.id,
          entityType: data.entityType as Comment['entityType'],
          entityId: data.entityId,
          userId: data.userId,
          userName: userData?.name ?? 'Unknown',
          userAvatarUrl: userData?.avatarUrl,
          body: data.body,
          createdAt: tsToIso(data.createdAt),
        };
      })
    );

    return comments;
  }

  async create(input: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    const id = uuidv4();
    const now = Timestamp.now();
    const data = {
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      body: input.body,
      createdAt: now,
    };
    await this.col.doc(id).set(data);
    return {
      id,
      ...input,
      createdAt: now.toDate().toISOString(),
    };
  }
}
