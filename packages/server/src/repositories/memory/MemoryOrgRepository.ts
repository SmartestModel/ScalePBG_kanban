import { v4 as uuidv4 } from 'uuid';
import { IOrgRepository } from '../../interfaces/repositories';
import {
  Organization,
  OrgMember,
  UserRole,
} from '../../types/index';

/**
 * Ephemeral in-memory implementation of IOrgRepository.
 * All data lives only for the lifetime of the server process.
 */
export class MemoryOrgRepository implements IOrgRepository {
  private orgs = new Map<string, Organization>();
  /**
   * Outer key: orgId, inner key: uid
   */
  private members = new Map<string, Map<string, OrgMember>>();

  constructor(
    seedOrgs: Organization[] = [],
    seedMembers: { orgId: string; member: OrgMember }[] = []
  ) {
    for (const org of seedOrgs) {
      this.orgs.set(org.id, org);
      this.members.set(org.id, new Map());
    }
    for (const { orgId, member } of seedMembers) {
      const bucket = this.members.get(orgId) ?? new Map();
      bucket.set(member.uid, member);
      this.members.set(orgId, bucket);
    }
  }

  async findById(id: string): Promise<Organization | null> {
    return this.orgs.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    for (const org of this.orgs.values()) {
      if (org.slug === slug) return org;
    }
    return null;
  }

  async findByUser(uid: string): Promise<Organization[]> {
    const result: Organization[] = [];
    for (const [orgId, bucket] of this.members.entries()) {
      if (bucket.has(uid)) {
        const org = this.orgs.get(orgId);
        if (org) result.push(org);
      }
    }
    return result;
  }

  async create(
    input: Omit<Organization, 'id' | 'createdAt'>,
    ownerUid: string
  ): Promise<Organization> {
    const id = uuidv4();
    const org: Organization = {
      id,
      ...input,
      ownerId: ownerUid,
      createdAt: new Date().toISOString(),
    };
    this.orgs.set(id, org);
    this.members.set(id, new Map());
    await this.addMember(id, ownerUid, 'admin', 40);
    return org;
  }

  async addMember(
    orgId: string,
    uid: string,
    role: UserRole,
    capacityHoursPerWeek = 40
  ): Promise<OrgMember> {
    const member: OrgMember = {
      uid,
      role,
      capacityHoursPerWeek,
      joinedAt: new Date().toISOString(),
    };
    const bucket = this.members.get(orgId) ?? new Map();
    bucket.set(uid, member);
    this.members.set(orgId, bucket);
    return member;
  }

  async getMembers(orgId: string): Promise<OrgMember[]> {
    const bucket = this.members.get(orgId);
    if (!bucket) return [];
    return Array.from(bucket.values());
  }

  async getMember(
    orgId: string,
    uid: string
  ): Promise<OrgMember | null> {
    return this.members.get(orgId)?.get(uid) ?? null;
  }

  async updateMemberRole(
    orgId: string,
    uid: string,
    role: UserRole
  ): Promise<void> {
    const bucket = this.members.get(orgId);
    if (!bucket) return;
    const member = bucket.get(uid);
    if (!member) return;
    bucket.set(uid, { ...member, role });
  }
}
