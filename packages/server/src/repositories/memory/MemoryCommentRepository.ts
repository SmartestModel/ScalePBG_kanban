import { v4 as uuidv4 } from 'uuid';
import { ICommentRepository } from '../../interfaces/repositories';
import { Comment } from '../../types/index';

/**
 * Ephemeral in-memory implementation of ICommentRepository.
 * All data lives only for the lifetime of the server process.
 */
export class MemoryCommentRepository implements ICommentRepository {
  private store = new Map<string, Comment>();

  constructor(seed: Comment[] = []) {
    for (const comment of seed) {
      this.store.set(comment.id, comment);
    }
  }

  async findByEntity(
    entityType: string,
    entityId: string
  ): Promise<Comment[]> {
    return Array.from(this.store.values())
      .filter(
        (c) =>
          c.entityType === entityType && c.entityId === entityId
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
      );
  }

  async create(
    input: Omit<Comment, 'id' | 'createdAt'>
  ): Promise<Comment> {
    const id = uuidv4();
    const comment: Comment = {
      id,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.store.set(id, comment);
    return comment;
  }
}
