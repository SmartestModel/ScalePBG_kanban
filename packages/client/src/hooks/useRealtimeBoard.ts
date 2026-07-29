import { useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useBoardStore } from '../store/useBoardStore';
import { Task } from '../types';

/**
 * Subscribes to Firestore real-time updates for all tasks in a sprint.
 * Updates the board store on any remote change.
 */
export function useRealtimeBoard(sprintId: string | null, taskIds: string[]) {
  const upsertTask = useBoardStore((s) => s.upsertTask);

  useEffect(() => {
    if (!sprintId || taskIds.length === 0) return;

    // Firestore 'in' has max 30 items per query — chunk if needed
    const chunkSize = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < taskIds.length; i += chunkSize) {
      chunks.push(taskIds.slice(i, i + chunkSize));
    }

    const unsubscribers = chunks.map((chunk) => {
      const q = query(
        collection(db, 'tasks'),
        where('__name__', 'in', chunk)
      );
      return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') return;
          const data = change.doc.data();
          upsertTask({
            id: change.doc.id,
            projectId: data.projectId,
            storyId: data.storyId,
            assigneeId: data.assigneeId,
            title: data.title,
            description: data.description,
            estimateHours: data.estimateHours ?? 0,
            priority: data.priority ?? 'medium',
            status: data.status ?? 'backlog',
            labelIds: data.labelIds ?? [],
            version: data.version ?? 1,
            createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
          } as Task);
        });
      });
    });

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [sprintId, taskIds.join(','), upsertTask]);
}

/**
 * Subscribes to Firestore real-time updates for ALL tasks in a project.
 * Used for backlog and full-project views.
 */
export function useRealtimeTasks(projectId: string | null) {
  const upsertTask = useBoardStore((s) => s.upsertTask);
  const removeTask = useBoardStore((s) => s.removeTask);

  useEffect(() => {
    if (!projectId) return;

    const q = query(
      collection(db, 'tasks'),
      where('projectId', '==', projectId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (change.type === 'removed') {
          removeTask(change.doc.id);
          return;
        }
        upsertTask({
          id: change.doc.id,
          projectId: data.projectId,
          storyId: data.storyId,
          assigneeId: data.assigneeId,
          title: data.title,
          description: data.description,
          estimateHours: data.estimateHours ?? 0,
          priority: data.priority ?? 'medium',
          status: data.status ?? 'backlog',
          labelIds: data.labelIds ?? [],
          version: data.version ?? 1,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
        } as Task);
      });
    });

    return unsub;
  }, [projectId, upsertTask, removeTask]);
}
