import { v4 as uuidv4 } from 'uuid';
import {
  IAccessRequestRepository,
} from '../../interfaces/repositories';
import {
  AccessRequest,
  AccessRequestStatus,
} from '../../types/index';

/**
 * Ephemeral in-memory implementation of IAccessRequestRepository.
 * All data lives only for the lifetime of the server process.
 */
export class MemoryAccessRequestRepository
  implements IAccessRequestRepository
{
  private store = new Map<string, AccessRequest>();

  constructor(seed: AccessRequest[] = []) {
    for (const req of seed) {
      this.store.set(req.id, req);
    }
  }

  async create(
    input: Omit<AccessRequest, 'id' | 'requestedAt' | 'status'>
  ): Promise<AccessRequest> {
    // Avoid duplicate pending requests from same user to same org
    for (const req of this.store.values()) {
      if (
        req.orgId === input.orgId &&
        req.userId === input.userId &&
        req.status === 'pending'
      ) {
        return req;
      }
    }

    const id = uuidv4();
    const record: AccessRequest = {
      id,
      ...input,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    this.store.set(id, record);
    return record;
  }

  async findById(id: string): Promise<AccessRequest | null> {
    return this.store.get(id) ?? null;
  }

  async findByOrg(
    orgId: string,
    status?: AccessRequestStatus
  ): Promise<AccessRequest[]> {
    let results = Array.from(this.store.values()).filter(
      (r) => r.orgId === orgId
    );
    if (status) {
      results = results.filter((r) => r.status === status);
    }
    return results.sort(
      (a, b) =>
        new Date(b.requestedAt).getTime() -
        new Date(a.requestedAt).getTime()
    );
  }

  async findByUser(userId: string): Promise<AccessRequest[]> {
    return Array.from(this.store.values())
      .filter((r) => r.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.requestedAt).getTime() -
          new Date(a.requestedAt).getTime()
      );
  }

  async updateStatus(
    id: string,
    status: AccessRequestStatus,
    reviewedBy: string
  ): Promise<AccessRequest> {
    const req = this.store.get(id);
    if (!req) {
      throw Object.assign(
        new Error('Access request not found'),
        { code: 404 }
      );
    }
    const updated: AccessRequest = {
      ...req,
      status,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    };
    this.store.set(id, updated);
    return updated;
  }
}
