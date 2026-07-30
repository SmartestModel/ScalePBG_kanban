import { v4 as uuidv4 } from 'uuid';
import { ITaskRepository } from '../../interfaces/repositories';
import {
  Task,
  CreateTaskInput,
  Subtask,
  CreateSubtaskInput,
} from '../../types/index';

/**
 * Ephemeral in-memory implementation of ITaskRepository.
 * All data lives only for the lifetime of the server process.
 */
export class MemoryTaskRepository implements ITaskRepository {
  private tasks = new Map<string, Task>();
  private subtasks = new Map<string, Subtask>();

  constructor(
    seedTasks: Task[] = [],
    seedSubtasks: Subtask[] = []
  ) {
    for (const task of seedTasks) {
      this.tasks.set(task.id, task);
    }
    for (const sub of seedSubtasks) {
      this.subtasks.set(sub.id, sub);
    }
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async findByProject(
    projectId: string,
    filter?: { status?: string; assigneeId?: string }
  ): Promise<Task[]> {
    let results = Array.from(this.tasks.values()).filter(
      (t) => t.projectId === projectId
    );
    if (filter?.status) {
      results = results.filter((t) => t.status === filter.status);
    }
    if (filter?.assigneeId) {
      results = results.filter(
        (t) => t.assigneeId === filter.assigneeId
      );
    }
    return results;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const task: Task = {
      id,
      projectId: input.projectId,
      storyId: input.storyId,
      assigneeId: input.assigneeId,
      title: input.title,
      description: input.description ?? '',
      estimateHours: input.estimateHours ?? 0,
      priority: input.priority ?? 'medium',
      status: input.status ?? 'backlog',
      labelIds: input.labelIds ?? [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: Partial<Task>
  ): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw Object.assign(new Error('Task not found'), {
        code: 404,
      });
    }
    if (task.version !== expectedVersion) {
      throw Object.assign(
        new Error(
          `VERSION_MISMATCH: expected ${expectedVersion},` +
          ` current is ${task.version}`
        ),
        { code: 409, currentVersion: task.version }
      );
    }
    const updated: Task = {
      ...task,
      ...changes,
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async addSubtask(
    taskId: string,
    input: CreateSubtaskInput
  ): Promise<Subtask> {
    const existing = Array.from(this.subtasks.values()).filter(
      (s) => s.taskId === taskId
    );
    const id = uuidv4();
    const subtask: Subtask = {
      id,
      taskId,
      title: input.title,
      isDone: false,
      orderIndex: existing.length,
    };
    this.subtasks.set(id, subtask);
    return subtask;
  }

  async getSubtasks(taskId: string): Promise<Subtask[]> {
    return Array.from(this.subtasks.values())
      .filter((s) => s.taskId === taskId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async toggleSubtask(
    subtaskId: string,
    isDone: boolean
  ): Promise<Subtask> {
    const sub = this.subtasks.get(subtaskId);
    if (!sub) {
      throw Object.assign(new Error('Subtask not found'), {
        code: 404,
      });
    }
    const updated = { ...sub, isDone };
    this.subtasks.set(subtaskId, updated);
    return updated;
  }
}
