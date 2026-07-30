import { v4 as uuidv4 } from 'uuid';
import { ISprintRepository } from '../../interfaces/repositories';
import {
  Sprint,
  CreateSprintInput,
  SprintItem,
  BurndownSnapshot,
} from '../../types/index';

/**
 * Ephemeral in-memory implementation of ISprintRepository.
 * All data lives only for the lifetime of the server process.
 */
export class MemorySprintRepository implements ISprintRepository {
  private sprints = new Map<string, Sprint>();
  private items = new Map<string, SprintItem>();
  /**
   * Quick lookup for task estimate hours needed by burndown.
   * Injected via setter to avoid circular dependency.
   */
  private getTaskEstimate?: (
    taskId: string
  ) => Promise<number>;

  constructor(
    seedSprints: Sprint[] = [],
    seedItems: SprintItem[] = []
  ) {
    for (const sprint of seedSprints) {
      this.sprints.set(sprint.id, sprint);
    }
    for (const item of seedItems) {
      this.items.set(item.id, item);
    }
  }

  /** Allow the factory to wire in a task-hours resolver. */
  setTaskEstimateResolver(
    fn: (taskId: string) => Promise<number>
  ): void {
    this.getTaskEstimate = fn;
  }

  async findById(id: string): Promise<Sprint | null> {
    return this.sprints.get(id) ?? null;
  }

  async findByProject(projectId: string): Promise<Sprint[]> {
    return Array.from(this.sprints.values())
      .filter((s) => s.projectId === projectId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
  }

  async create(input: CreateSprintInput): Promise<Sprint> {
    const id = uuidv4();
    const sprint: Sprint = {
      id,
      projectId: input.projectId,
      name: input.name,
      goal: input.goal,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'planning',
      createdAt: new Date().toISOString(),
    };
    this.sprints.set(id, sprint);
    return sprint;
  }

  async updateStatus(
    id: string,
    status: 'planning' | 'active' | 'closed'
  ): Promise<Sprint> {
    const sprint = this.sprints.get(id);
    if (!sprint) {
      throw Object.assign(new Error('Sprint not found'), {
        code: 404,
      });
    }
    const updated = { ...sprint, status };
    this.sprints.set(id, updated);
    return updated;
  }

  async addItems(
    sprintId: string,
    taskIds: string[]
  ): Promise<SprintItem[]> {
    const existing = Array.from(this.items.values()).filter(
      (i) => i.sprintId === sprintId
    );
    const existingTaskIds = new Set(existing.map((i) => i.taskId));
    let orderBase = existing.length;
    const newItems: SprintItem[] = [];

    for (const taskId of taskIds) {
      if (existingTaskIds.has(taskId)) continue;
      const id = uuidv4();
      const item: SprintItem = {
        id,
        sprintId,
        taskId,
        status: 'todo',
        orderIndex: orderBase++,
      };
      this.items.set(id, item);
      newItems.push(item);
    }
    return newItems;
  }

  async removeItem(
    sprintId: string,
    taskId: string
  ): Promise<boolean> {
    let removed = false;
    for (const [id, item] of this.items.entries()) {
      if (item.sprintId === sprintId && item.taskId === taskId) {
        this.items.delete(id);
        removed = true;
      }
    }
    return removed;
  }

  async getItems(sprintId: string): Promise<SprintItem[]> {
    return Array.from(this.items.values())
      .filter((i) => i.sprintId === sprintId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async updateItemOrder(
    sprintId: string,
    itemOrders: {
      taskId: string;
      orderIndex: number;
      status: string;
    }[]
  ): Promise<void> {
    for (const order of itemOrders) {
      for (const [id, item] of this.items.entries()) {
        if (
          item.sprintId === sprintId &&
          item.taskId === order.taskId
        ) {
          this.items.set(id, {
            ...item,
            orderIndex: order.orderIndex,
            status: order.status as SprintItem['status'],
          });
          break;
        }
      }
    }
  }

  async getBurndownData(
    sprintId: string
  ): Promise<BurndownSnapshot[]> {
    const sprint = await this.findById(sprintId);
    if (!sprint || !sprint.startDate || !sprint.endDate) {
      return [];
    }

    const items = await this.getItems(sprintId);
    if (items.length === 0) return [];

    const resolver = this.getTaskEstimate ?? (async () => 0);
    const estimates = await Promise.all(
      items.map((i) => resolver(i.taskId))
    );
    const totalPoints = estimates.reduce((s, h) => s + h, 0);

    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const msPerDay = 86_400_000;
    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / msPerDay
    );

    const snapshots: BurndownSnapshot[] = [];
    const completedEstimates = items.reduce((sum, item, idx) => {
      return item.status === 'done' ? sum + estimates[idx] : sum;
    }, 0);

    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(start.getTime() + i * msPerDay)
        .toISOString()
        .split('T')[0];
      const idealPoints =
        totalPoints - (totalPoints / totalDays) * i;
      const completedPoints =
        i === totalDays ? completedEstimates : 0;

      snapshots.push({
        date,
        remainingPoints: Math.max(
          0,
          totalPoints - completedPoints
        ),
        idealPoints: Math.max(0, idealPoints),
        completedPoints,
      });
    }
    return snapshots;
  }
}
