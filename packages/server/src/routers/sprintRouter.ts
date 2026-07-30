import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, withOrgRole } from '../auth/middleware';
import { assertCan } from '../auth/rbac';
import {
  ISprintRepository,
  IOrgRepository,
  IProjectRepository,
  ITaskRepository,
} from '../interfaces/repositories';

const CreateSprintSchema = z.object({
  name: z.string().min(1).max(255),
  goal: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

const AddItemsSchema = z.object({
  taskIds: z.array(z.string()).min(1),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['planning', 'active', 'closed']),
});

export function buildSprintRouter(
  sprintRepo: ISprintRepository,
  orgRepo: IOrgRepository,
  projectRepo: IProjectRepository,
  taskRepo: ITaskRepository
): Router {
  const router = Router();

  /** Helper: resolve orgId from projectId */
  async function getOrgIdForProject(
    projectId: string
  ): Promise<string | null> {
    const project = await projectRepo.findById(projectId);
    return project?.orgId ?? null;
  }

  /**
   * GET /projects/:projectId/sprints
   */
  router.get(
    '/projects/:projectId/sprints',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const sprints = await sprintRepo.findByProject(req.params.projectId);
        res.json({ success: true, data: sprints });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * POST /projects/:projectId/sprints
   */
  router.post(
    '/projects/:projectId/sprints',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        // Resolve org role for RBAC
        const orgId = await getOrgIdForProject(req.params.projectId);
        if (orgId) {
          const member = await orgRepo.getMember(orgId, req.user!.uid);
          if (member) req.user!.role = member.role;
        }
        assertCan(req.user!, 'sprint:create');

        const parsed = CreateSprintSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        const sprint = await sprintRepo.create({
          projectId: req.params.projectId,
          ...parsed.data,
        });
        res.status(201).json({ success: true, data: sprint });
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
   * GET /sprints/:sprintId
   */
  router.get(
    '/sprints/:sprintId',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const sprint = await sprintRepo.findById(req.params.sprintId);
        if (!sprint) {
          res.status(404).json({ success: false, error: { message: 'Sprint not found' } });
          return;
        }
        res.json({ success: true, data: sprint });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * PATCH /sprints/:sprintId/status
   */
  router.patch(
    '/sprints/:sprintId/status',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const sprint = await sprintRepo.findById(req.params.sprintId);
        if (!sprint) {
          res.status(404).json({ success: false, error: { message: 'Sprint not found' } });
          return;
        }
        const orgId = await getOrgIdForProject(sprint.projectId);
        if (orgId) {
          const member = await orgRepo.getMember(orgId, req.user!.uid);
          if (member) req.user!.role = member.role;
        }
        assertCan(req.user!, 'sprint:close');

        const parsed = UpdateStatusSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        const updated = await sprintRepo.updateStatus(
          req.params.sprintId,
          parsed.data.status
        );
        res.json({ success: true, data: updated });
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
   * POST /sprints/:sprintId/items
   */
  router.post(
    '/sprints/:sprintId/items',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const sprint = await sprintRepo.findById(req.params.sprintId);
        if (!sprint) {
          res.status(404).json({ success: false, error: { message: 'Sprint not found' } });
          return;
        }
        const orgId = await getOrgIdForProject(sprint.projectId);
        if (orgId) {
          const member = await orgRepo.getMember(orgId, req.user!.uid);
          if (member) req.user!.role = member.role;
        }
        assertCan(req.user!, 'sprint:add_items');

        const parsed = AddItemsSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        const items = await sprintRepo.addItems(
          req.params.sprintId,
          parsed.data.taskIds
        );
        res.status(201).json({ success: true, data: items });
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
   * GET /sprints/:sprintId/board
   * Returns sprint items + their associated tasks.
   */
  router.get(
    '/sprints/:sprintId/board',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const items = await sprintRepo.getItems(req.params.sprintId);
        const taskIds = items.map((i) => i.taskId);

        // Fetch all tasks in parallel via taskRepo (mock-safe)
        const taskMap: Record<string, unknown> = {};
        await Promise.all(
          taskIds.map(async (id) => {
            const task = await taskRepo.findById(id);
            if (task) taskMap[id] = task;
          })
        );

        res.json({ success: true, data: { items, tasks: taskMap } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /sprints/:sprintId/burndown
   */
  router.get(
    '/sprints/:sprintId/burndown',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const data = await sprintRepo.getBurndownData(req.params.sprintId);
        res.json({ success: true, data });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * DELETE /sprints/:sprintId/items/:taskId
   */
  router.delete(
    '/sprints/:sprintId/items/:taskId',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const removed = await sprintRepo.removeItem(
          req.params.sprintId,
          req.params.taskId
        );
        res.json({ success: true, data: { removed } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  return router;
}
