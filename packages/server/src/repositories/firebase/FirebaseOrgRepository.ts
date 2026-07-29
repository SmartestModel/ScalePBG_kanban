import { v4 as uuidv4 } from 'uuid';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { IOrgRepository } from '../../interfaces/repositories';
import {
  Organization,
  OrgMember,
  UserRole,
} from '../../types/index';

function tsToIso(val: Timestamp | string | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export class FirebaseOrgRepository implements IOrgRepository {
  private orgCol: FirebaseFirestore.CollectionReference;

  constructor(private db: Firestore) {
    this.orgCol = db.collection('organizations');
  }

  async findById(id: string): Promise<Organization | null> {
    const doc = await this.orgCol.doc(id).get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    return {
      id: doc.id,
      name: d.name,
      slug: d.slug,
      ownerId: d.ownerId,
      createdAt: tsToIso(d.createdAt),
    };
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const snap = await this.orgCol.where('slug', '==', slug).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name,
      slug: d.slug,
      ownerId: d.ownerId,
      createdAt: tsToIso(d.createdAt),
    };
  }

  async findByUser(uid: string): Promise<Organization[]> {
    // Find orgs where user is a member via subcollection group query
    const memberSnap = await this.db
      .collectionGroup('members')
      .where('uid', '==', uid)
      .get();

    const orgIds = memberSnap.docs
      .map((d) => d.ref.parent.parent?.id)
      .filter((id): id is string => !!id);

    if (orgIds.length === 0) return [];

    // Firestore 'in' supports up to 30 values
    const orgSnap = await this.orgCol.where('__name__', 'in', orgIds).get();
    return orgSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        slug: d.slug,
        ownerId: d.ownerId,
        createdAt: tsToIso(d.createdAt),
      };
    });
  }

  async create(
    input: Omit<Organization, 'id' | 'createdAt'>,
    ownerUid: string
  ): Promise<Organization> {
    const id = uuidv4();
    const now = Timestamp.now();
    const data = {
      name: input.name,
      slug: input.slug,
      ownerId: ownerUid,
      createdAt: now,
    };
    await this.orgCol.doc(id).set(data);

    // Add creator as admin member
    await this.addMember(id, ownerUid, 'admin', 40);

    return {
      id,
      ...input,
      ownerId: ownerUid,
      createdAt: now.toDate().toISOString(),
    };
  }

  async addMember(
    orgId: string,
    uid: string,
    role: UserRole,
    capacityHoursPerWeek: number = 40
  ): Promise<OrgMember> {
    const memberData = {
      uid,
      role,
      capacityHoursPerWeek,
      joinedAt: Timestamp.now(),
    };
    await this.orgCol.doc(orgId).collection('members').doc(uid).set(memberData);
    return {
      uid,
      role,
      capacityHoursPerWeek,
      joinedAt: memberData.joinedAt.toDate().toISOString(),
    };
  }

  async getMembers(orgId: string): Promise<OrgMember[]> {
    const snap = await this.orgCol
      .doc(orgId)
      .collection('members')
      .get();

    // Enrich with user profile data
    const members = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const userDoc = await this.db.collection('users').doc(data.uid).get();
        const userData = userDoc.data();
        return {
          uid: data.uid,
          role: data.role as UserRole,
          capacityHoursPerWeek: data.capacityHoursPerWeek ?? 40,
          joinedAt: tsToIso(data.joinedAt),
          name: userData?.name,
          email: userData?.email,
          avatarUrl: userData?.avatarUrl,
        };
      })
    );

    return members;
  }

  async getMember(orgId: string, uid: string): Promise<OrgMember | null> {
    const doc = await this.orgCol
      .doc(orgId)
      .collection('members')
      .doc(uid)
      .get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    return {
      uid: data.uid,
      role: data.role as UserRole,
      capacityHoursPerWeek: data.capacityHoursPerWeek ?? 40,
      joinedAt: tsToIso(data.joinedAt),
    };
  }

  async updateMemberRole(
    orgId: string,
    uid: string,
    role: UserRole
  ): Promise<void> {
    await this.orgCol
      .doc(orgId)
      .collection('members')
      .doc(uid)
      .update({ role });
  }
}
