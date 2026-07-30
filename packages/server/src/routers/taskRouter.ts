import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { assertCan } from '../auth/rbac';
import {
  ITaskRepository,
  ICommentRepository,
  IOrgRepository,
  IProjectRepository,
} from '../interfaces/repositories';

const CreateTaskSchema = z.object({
  projectId: z.string(),
  storyId: z.string().optional(),
  assigneeId: z.string().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  estimateHours: z.number().min(0).default(0),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z
    .enum(['backlog', 'todo', 'in_progress', 'in_review', 'done'])
    .default('backlog'),
  labelIds: z.array(z.string()).default([]),
});

const UpdateTaskSchema = z.object({
  version: z.number().int().positive(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  estimateHours: z.number().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z
    .enum(['backlog', 'todo', 'in_progress', 'in_review', 'done'])
    .optional(),
  labelIds: z.array(z.string()).optional(),
});

const CreateCommentSchema = z.object({
  body: z.string().min(1),
});

const CreateSubtaskSchema = z.object({
  title: z.string().min(1).max(255),
});

export function buildTaskRouter(
  taskRepo: ITaskRepository,
  commentRepo: ICommentRepository,
  orgRepo: IOrgRepository,
  projectRepo: IProjectRepository
): Router {
  const router = Router();

  /** Helper: resolve orgId from projectId and attach role to req.user */
  async function resolveOrgRole(
    req: Request,
    projectId: string
  ): Promise<void> {
    const project = await projectRepo.findById(projectId);
    if (!project) return;
    const member = await orgRepo.getMember(
      project.orgId,
      req.user!.uid
    );
    if (member) req.user!.role = member.role;
  }

  /**
   * POST /tasks
   */
  router.post(
    '/',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = CreateTaskSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        const task = await taskRepo.create(parsed.data);
        res.status(201).json({ success: true, data: task });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /tasks/:id
   */
  router.get(
    '/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const task = await taskRepo.findById(req.params.id);
        if (!task) {
          res.status(404).json({ success: false, error: { message: 'Task not found' } });
          return;
        }
        const [subtasks, comments] = await Promise.all([
          taskRepo.getSubtasks(req.params.id),
          commentRepo.findByEntity('task', req.params.id),
        ]);
        res.json({ success: true, data: { ...task, subtasks, comments } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /tasks?projectId=xxx
   */
  router.get(
    '/',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const projectId = req.query.projectId as string;
        if (!projectId) {
          res.status(400).json({
            success: false,
            error: { message: 'projectId query parameter is required' },
          });
          return;
        }
        const tasks = await taskRepo.findByProject(projectId, {
          status: req.query.status as string | undefined,
          assigneeId: req.query.assigneeId as string | undefined,
        });
        res.json({ success: true, data: tasks });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * PATCH /tasks/:id
   * Requires version in body for optimistic locking.
   */
  router.patch(
    '/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = UpdateTaskSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }

        const existing = await taskRepo.findById(req.params.id);
        if (!existing) {
          res.status(404).json({ success: false, error: { message: 'Task not found' } });
          return;
        }

        // Resolve role + RBAC
        await resolveOrgRole(req, existing.projectId);
        assertCan(req.user!, 'task:edit', existing.assigneeId);

        const { version, ...changes } = parsed.data;
        // Normalize null → undefined for optional fields
        const safeChanges: Partial<import('../types/index').Task> = {
          ...changes,
          assigneeId: changes.assigneeId ?? undefined,
        };
        const updated = await taskRepo.updateWithVersion(
          req.params.id,
          version,
          safeChanges
        );
        res.json({ success: true, data: updated });
      } catch (err: unknown) {
        const e = err as {
          code?: number;
          message?: string;
          currentVersion?: number;
        };
        if (e.message?.includes('VERSION_MISMATCH')) {
          res.status(409).json({
            success: false,
            error: {
              code: 'CONFLICT_DETECTED',
              message: 'Task was modified by another user.',
              currentVersion: e.currentVersion,
            },
          });
          return;
        }
        res.status(e.code ?? 500).json({
          success: false,
          error: { message: e.message ?? 'Unknown error' },
        });
      }
    }
  );

  /**
   * DELETE /tasks/:id
   */
  router.delete(
    '/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const existing = await taskRepo.findById(req.params.id);
        if (!existing) {
          res.status(404).json({ success: false, error: { message: 'Task not found' } });
          return;
        }
        await resolveOrgRole(req, existing.projectId);
        assertCan(req.user!, 'task:delete');
        await taskRepo.delete(req.params.id);
        res.json({ success: true });
      } catch (err: unknown) {
        const e = err as { code?: number; message?: string };
        res.status(e.code ?? 500).json({
          success: false,
          error: { message: e.message ?? 'Unknown error' },
        });
      }
    }
  );

  /**
   * POST /tasks/:id/comments
   */
  router.post(
    '/:id/comments',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = CreateCommentSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        const comment = await commentRepo.create({
          entityType: 'task',
          entityId: req.params.id,
          userId: req.user!.uid,
          userName: req.user!.name,
          userAvatarUrl: req.user!.avatarUrl,
          body: parsed.data.body,
        });
        res.status(201).json({ success: true, data: comment });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /tasks/:id/subtasks
   */
  router.get(
    '/:id/subtasks',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const subtasks = await taskRepo.getSubtasks(req.params.id);
        res.json({ success: true, data: subtasks });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * POST /tasks/:id/subtasks
   */
  router.post(
    '/:id/subtasks',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = CreateSubtaskSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        const subtask = await taskRepo.addSubtask(req.params.id, parsed.data);
        res.status(201).json({ success: true, data: subtask });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * PATCH /tasks/subtasks/:subtaskId/toggle
   */
  router.patch(
    '/subtasks/:subtaskId/toggle',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { isDone } = req.body as { isDone: boolean };
        const subtask = await taskRepo.toggleSubtask(
          req.params.subtaskId,
          isDone
        );
        res.json({ success: true, data: subtask });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  return router;
}
