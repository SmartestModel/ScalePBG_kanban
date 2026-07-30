import { v4 as uuidv4 } from 'uuid';
import { IProjectRepository } from '../../interfaces/repositories';
import { Project, Epic, Task } from '../../types/index';

/**
 * Ephemeral in-memory implementation of IProjectRepository.
 * All data lives only for the lifetime of the server process.
 */
export class MemoryProjectRepository
  implements IProjectRepository
{
  private projects = new Map<string, Project>();
  private epics = new Map<string, Epic>();
  private tasks: Map<string, Task>;

  /**
   * @param tasks - Shared task map injected from the factory so
   *   backlog queries see the same task data as the task repo.
   */
  constructor(
    tasks: Map<string, Task>,
    seedProjects: Project[] = [],
    seedEpics: Epic[] = []
  ) {
    this.tasks = tasks;
    for (const p of seedProjects) this.projects.set(p.id, p);
    for (const e of seedEpics) this.epics.set(e.id, e);
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }

  async findByOrg(orgId: string): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter((p) => p.orgId === orgId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
      );
  }

  async create(
    input: Omit<Project, 'id' | 'createdAt'>
  ): Promise<Project> {
    const id = uuidv4();
    const project: Project = {
      id,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.projects.set(id, project);
    return project;
  }

  async keyExistsInOrg(
    orgId: string,
    key: string
  ): Promise<boolean> {
    for (const p of this.projects.values()) {
      if (p.orgId === orgId && p.key === key) return true;
    }
    return false;
  }

  async getEpics(projectId: string): Promise<Epic[]> {
    return Array.from(this.epics.values()).filter(
      (e) => e.projectId === projectId
    );
  }

  async createEpic(
    input: Omit<Epic, 'id' | 'createdAt'>
  ): Promise<Epic> {
    const id = uuidv4();
    const epic: Epic = {
      id,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.epics.set(id, epic);
    return epic;
  }

  async getBacklog(projectId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(
      (t) =>
        t.projectId === projectId && t.status === 'backlog'
    );
  }
}
