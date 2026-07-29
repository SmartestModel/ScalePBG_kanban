import { create } from 'zustand';
import { Task, TaskStatus } from '../types';
import { updateTask } from '../services/api';

interface BoardState {
  tasks: Record<string, Task>;
  activeDragId: string | null;

  setTasks: (tasks: Task[]) => void;
  upsertTask: (task: Task) => void;
  removeTask: (taskId: string) => void;
  setActiveDrag: (id: string | null) => void;
  moveTask: (
    taskId: string,
    targetStatus: TaskStatus,
    newOrderIndex?: number
  ) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  tasks: {},
  activeDragId: null,

  setTasks: (tasks) => {
    const taskMap: Record<string, Task> = {};
    tasks.forEach((t) => (taskMap[t.id] = t));
    set({ tasks: taskMap });
  },

  upsertTask: (task) =>
    set((state) => ({ tasks: { ...state.tasks, [task.id]: task } })),

  removeTask: (taskId) =>
    set((state) => {
      const { [taskId]: _, ...rest } = state.tasks;
      return { tasks: rest };
    }),

  setActiveDrag: (id) => set({ activeDragId: id }),

  /**
   * Optimistically moves a task to a new column/status.
   * On network failure, reverts to the original state.
   */
  moveTask: async (taskId, targetStatus, newOrderIndex) => {
    const originalTask = get().tasks[taskId];
    if (!originalTask) return;

    // 1. Optimistic update
    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskId]: { ...originalTask, status: targetStatus },
      },
    }));

    try {
      // 2. Persist to API with version check
      const response = await updateTask(taskId, {
        version: originalTask.version,
        status: targetStatus,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message ?? 'Update failed');
      }

      // 3. Apply server-returned state (new version number)
      set((state) => ({
        tasks: { ...state.tasks, [taskId]: response.data! },
      }));
    } catch (err: unknown) {
      // 4. Rollback on failure
      set((state) => ({
        tasks: { ...state.tasks, [taskId]: originalTask },
      }));

      const errObj = err as { response?: { status?: number; data?: { error?: { currentVersion?: number } } } };
      if (errObj?.response?.status === 409) {
        const currentVersion = errObj.response?.data?.error?.currentVersion;
        throw Object.assign(
          new Error(`Version conflict — task was modified by another user.`),
          { type: 'CONFLICT', currentVersion }
        );
      }
      throw err;
    }
  },
}));
