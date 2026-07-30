import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, withOrgRole } from '../auth/middleware';
import { assertCan } from '../auth/rbac';
import {
  IOrgRepository,
  IProjectRepository,
} from '../interfaces/repositories';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(
      /^[A-Z0-9]+$/,
      'Key must be uppercase letters and numbers'
    ),
  description: z.string().optional(),
});

const CreateEpicSchema = z.object({
  title: z.string().min(1).max(255),
  goal: z.string().optional(),
  color: z.string().default('#3B82F6'),
});

export function buildProjectRouter(
  orgRepo: IOrgRepository,
  projectRepo: IProjectRepository
): Router {
  const router = Router();
  const orgRoleMiddleware = withOrgRole(orgRepo);

  /**
   * GET /orgs/:orgId/projects
   */
  router.get(
    '/orgs/:orgId/projects',
    requireAuth,
    orgRoleMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.user?.role) {
          res.status(403).json({
            success: false,
            error: { code: 'NOT_MEMBER' },
          });
          return;
        }
        const projects = await projectRepo.findByOrg(
          req.params.orgId
        );
        res.json({ success: true, data: projects });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({
          success: false,
          error: { message },
        });
      }
    }
  );

  /**
   * POST /orgs/:orgId/projects
   */
  router.post(
    '/orgs/:orgId/projects',
    requireAuth,
    orgRoleMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        assertCan(req.user!, 'project:create');
        const parsed = CreateProjectSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: parsed.error.message,
            },
          });
          return;
        }

        const keyTaken = await projectRepo.keyExistsInOrg(
          req.params.orgId,
          parsed.data.key
        );
        if (keyTaken) {
          res.status(409).json({
            success: false,
            error: {
              code: 'KEY_TAKEN',
              message: `Project key '${parsed.data.key}' already exists in this org.`,
            },
          });
          return;
        }

        const project = await projectRepo.create({
          orgId: req.params.orgId,
          key: parsed.data.key,
          name: parsed.data.name,
          description: parsed.data.description ?? '',
        });
        res.status(201).json({ success: true, data: project });
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
   * GET /projects/:projectId
   */
  router.get(
    '/projects/:projectId',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const project = await projectRepo.findById(
          req.params.projectId
        );
        if (!project) {
          res.status(404).json({
            success: false,
            error: { message: 'Project not found' },
          });
          return;
        }
        res.json({ success: true, data: project });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({
          success: false,
          error: { message },
        });
      }
    }
  );

  /**
   * GET /projects/:projectId/backlog
   * Returns tasks with status 'backlog' for the project.
   */
  router.get(
    '/projects/:projectId/backlog',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const tasks = await projectRepo.getBacklog(
          req.params.projectId
        );
        res.json({ success: true, data: tasks });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({
          success: false,
          error: { message },
        });
      }
    }
  );

  /**
   * GET /projects/:projectId/epics
   */
  router.get(
    '/projects/:projectId/epics',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const epics = await projectRepo.getEpics(
          req.params.projectId
        );
        res.json({ success: true, data: epics });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({
          success: false,
          error: { message },
        });
      }
    }
  );

  /**
   * POST /projects/:projectId/epics
   */
  router.post(
    '/projects/:projectId/epics',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = CreateEpicSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: parsed.error.message,
            },
          });
          return;
        }
        const epic = await projectRepo.createEpic({
          projectId: req.params.projectId,
          title: parsed.data.title,
          goal: parsed.data.goal ?? '',
          color: parsed.data.color,
          status: 'open',
        });
        res.status(201).json({ success: true, data: epic });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({
          success: false,
          error: { message },
        });
      }
    }
  );

  return router;
}
