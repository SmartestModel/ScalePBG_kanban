import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { IUserRepository } from '../../interfaces/repositories';
import { User } from '../../types/index';

function tsToIso(val: Timestamp | string | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export class FirebaseUserRepository implements IUserRepository {
  private col: FirebaseFirestore.CollectionReference;

  constructor(private db: Firestore) {
    this.col = db.collection('users');
  }

  async findById(id: string): Promise<User | null> {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    return {
      id: doc.id,
      email: d.email,
      name: d.name,
      avatarUrl: d.avatarUrl,
      createdAt: tsToIso(d.createdAt),
      updatedAt: tsToIso(d.updatedAt),
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const snap = await this.col
      .where('email', '==', email)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const d = doc.data();
    return {
      id: doc.id,
      email: d.email,
      name: d.name,
      avatarUrl: d.avatarUrl,
      createdAt: tsToIso(d.createdAt),
      updatedAt: tsToIso(d.updatedAt),
    };
  }

  /**
   * Upserts a user profile doc using their Firebase Auth UID as the doc ID.
   * Called after every successful login to keep profile data fresh.
   */
  async upsert(
    user: Omit<User, 'createdAt' | 'updatedAt'>
  ): Promise<User> {
    const ref = this.col.doc(user.id);
    const existing = await ref.get();
    const now = Timestamp.now();

    if (existing.exists) {
      await ref.update({
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl ?? null,
        updatedAt: now,
      });
      const d = existing.data()!;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: tsToIso(d.createdAt),
        updatedAt: now.toDate().toISOString(),
      };
    } else {
      const data = {
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await ref.set(data);
      return {
        id: user.id,
        ...data,
        avatarUrl: data.avatarUrl ?? undefined,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      };
    }
  }
}
