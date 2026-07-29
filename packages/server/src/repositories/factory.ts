import { getDb } from '../firebase/admin';
import { IRepositoryFactory } from '../interfaces/repositories';
import { FirebaseTaskRepository } from './firebase/FirebaseTaskRepository';
import { FirebaseSprintRepository } from './firebase/FirebaseSprintRepository';
import { FirebaseOrgRepository } from './firebase/FirebaseOrgRepository';
import { FirebaseAccessRequestRepository } from './firebase/FirebaseAccessRequestRepository';
import { FirebaseUserRepository } from './firebase/FirebaseUserRepository';
import { FirebaseCommentRepository } from './firebase/FirebaseCommentRepository';

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
}

export function createRepositoryFactory(): IRepositoryFactory {
  return new FirebaseRepositoryFactory();
}
