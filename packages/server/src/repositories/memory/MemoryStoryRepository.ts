import { v4 as uuidv4 } from 'uuid';
import { IStoryRepository } from '../../interfaces/repositories';
import { Story } from '../../types/index';

export class MemoryStoryRepository implements IStoryRepository {
  private stories = new Map<string, Story>();

  constructor(seedStories: Story[] = []) {
    for (const s of seedStories) {
      this.stories.set(s.id, s);
    }
  }

  async findById(id: string): Promise<Story | null> {
    return this.stories.get(id) ?? null;
  }

  async findByProject(projectId: string): Promise<Story[]> {
    return Array.from(this.stories.values()).filter(
      (s) => s.projectId === projectId
    );
  }

  async findByEpic(epicId: string): Promise<Story[]> {
    return Array.from(this.stories.values()).filter(
      (s) => s.epicId === epicId
    );
  }

  async create(input: Omit<Story, 'id' | 'createdAt'>): Promise<Story> {
    const id = uuidv4();
    const story: Story = {
      id,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.stories.set(id, story);
    return story;
  }

  async update(id: string, changes: Partial<Story>): Promise<Story> {
    const existing = this.stories.get(id);
    if (!existing) throw new Error('Story not found');
    const updated: Story = {
      ...existing,
      ...changes,
    };
    this.stories.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.stories.delete(id);
  }
}
