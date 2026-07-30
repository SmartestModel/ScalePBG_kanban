import { v4 as uuidv4 } from 'uuid';
import { IUserRepository } from '../../interfaces/repositories';
import { User } from '../../types/index';

/**
 * Ephemeral in-memory implementation of IUserRepository.
 * All data lives only for the lifetime of the server process.
 */
export class MemoryUserRepository implements IUserRepository {
  private store = new Map<string, User>();

  constructor(seed: User[] = []) {
    for (const user of seed) {
      this.store.set(user.id, user);
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async upsert(
    user: Omit<User, 'createdAt' | 'updatedAt'>
  ): Promise<User> {
    const now = new Date().toISOString();
    const existing = this.store.get(user.id);
    const record: User = {
      ...user,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.store.set(user.id, record);
    return record;
  }
}
