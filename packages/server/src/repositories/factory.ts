import { getDb } from '../firebase/admin';
import { IRepositoryFactory } from '../interfaces/repositories';
import { FirebaseTaskRepository } from './firebase/FirebaseTaskRepository';
import { FirebaseSprintRepository } from './firebase/FirebaseSprintRepository';
import { FirebaseOrgRepository } from './firebase/FirebaseOrgRepository';
import {
  FirebaseAccessRequestRepository,
} from './firebase/FirebaseAccessRequestRepository';
import { FirebaseUserRepository } from './firebase/FirebaseUserRepository';
import { FirebaseCommentRepository } from './firebase/FirebaseCommentRepository';
import { FirebaseProjectRepository } from './firebase/FirebaseProjectRepository';
import { FirebaseStoryRepository } from './firebase/FirebaseStoryRepository';
import { MemoryRepositoryFactory } from './memory/MemoryRepositoryFactory';

export class FirebaseRepositoryFactory implements IRepositoryFactory {
  private db = getDb();

  getTaskRepository() {
    return new FirebaseTaskRepository(this.db);
  }

  getSprintRepository() {
    return new FirebaseSprintRepository(this.db);
  }

  getOrgRepository() {
    return new FirebaseOrgRepository(this.db);
  }

  getAccessRequestRepository() {
    return new FirebaseAccessRequestRepository(this.db);
  }

  getUserRepository() {
    return new FirebaseUserRepository(this.db);
  }

  getCommentRepository() {
    return new FirebaseCommentRepository(this.db);
  }

  getProjectRepository() {
    return new FirebaseProjectRepository(this.db);
  }

  getStoryRepository() {
    return new FirebaseStoryRepository(this.db);
  }
}

/**
 * Creates the correct repository factory based on the USE_MOCK
 * environment variable. When USE_MOCK=true, an in-memory factory
 * is returned — all data is ephemeral and lost on server restart.
 */
export function createRepositoryFactory(): IRepositoryFactory {
  if (process.env.USE_MOCK === 'true') {
    console.log(
      '[Server] ⚠️  MOCK MODE active — data is ephemeral.'
    );
    return new MemoryRepositoryFactory();
  }
  return new FirebaseRepositoryFactory();
}
