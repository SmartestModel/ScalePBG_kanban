import { v4 as uuidv4 } from 'uuid';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { IAccessRequestRepository } from '../../interfaces/repositories';
import {
  AccessRequest,
  AccessRequestStatus,
} from '../../types/index';

function tsToIso(val: Timestamp | string | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

function docToRequest(
  id: string,
  data: FirebaseFirestore.DocumentData
): AccessRequest {
  return {
    id,
    orgId: data.orgId,
    orgName: data.orgName,
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName,
    userAvatarUrl: data.userAvatarUrl,
    status: data.status as AccessRequestStatus,
    requestedAt: tsToIso(data.requestedAt),
    reviewedBy: data.reviewedBy,
    reviewedAt: data.reviewedAt ? tsToIso(data.reviewedAt) : undefined,
  };
}

export class FirebaseAccessRequestRepository
  implements IAccessRequestRepository
{
  private col: FirebaseFirestore.CollectionReference;

  constructor(private db: Firestore) {
    this.col = db.collection('access_requests');
  }

  async create(
    input: Omit<AccessRequest, 'id' | 'requestedAt' | 'status'>
  ): Promise<AccessRequest> {
    // Check for existing pending request from same user for same org
    const existing = await this.col
      .where('orgId', '==', input.orgId)
      .where('userId', '==', input.userId)
      .where('status', '==', 'pending')
      .get();

    if (!existing.empty) {
      // Return existing pending request instead of creating duplicate
      const doc = existing.docs[0];
      return docToRequest(doc.id, doc.data());
    }

    const id = uuidv4();
    const data = {
      ...input,
      status: 'pending' as AccessRequestStatus,
      requestedAt: Timestamp.now(),
      reviewedBy: null,
      reviewedAt: null,
    };
    await this.col.doc(id).set(data);
    return {
      id,
      ...input,
      status: 'pending' as AccessRequestStatus,
      requestedAt: data.requestedAt.toDate().toISOString(),
    };
  }

  async findById(id: string): Promise<AccessRequest | null> {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) return null;
    return docToRequest(doc.id, doc.data()!);
  }

  async findByOrg(
    orgId: string,
    status?: AccessRequestStatus
  ): Promise<AccessRequest[]> {
    let query: FirebaseFirestore.Query = this.col.where(
      'orgId',
      '==',
      orgId
    );
    if (status) {
      query = query.where('status', '==', status);
    }
    query = query.orderBy('requestedAt', 'desc');
    const snap = await query.get();
    return snap.docs.map((d) => docToRequest(d.id, d.data()));
  }

  async findByUser(userId: string): Promise<AccessRequest[]> {
    const snap = await this.col
      .where('userId', '==', userId)
      .orderBy('requestedAt', 'desc')
      .get();
    return snap.docs.map((d) => docToRequest(d.id, d.data()));
  }

  async updateStatus(
    id: string,
    status: AccessRequestStatus,
    reviewedBy: string
  ): Promise<AccessRequest> {
    const ref = this.col.doc(id);
    await ref.update({
      status,
      reviewedBy,
      reviewedAt: Timestamp.now(),
    });
    const doc = await ref.get();
    return docToRequest(doc.id, doc.data()!);
  }
}
