import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, withOrgRole } from '../auth/middleware';
import { assertCan } from '../auth/rbac';
import { IOrgRepository } from '../interfaces/repositories';
import { getDb } from '../firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Key must be uppercase letters and numbers'),
  description: z.string().optional(),
});

const CreateEpicSchema = z.object({
  title: z.string().min(1).max(255),
  goal: z.string().optional(),
  color: z.string().default('#3B82F6'),
});

export function buildProjectRouter(orgRepo: IOrgRepository): Router {
  const router = Router();
  const db = getDb();
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
          res.status(403).json({ success: false, error: { code: 'NOT_MEMBER' } });
          return;
        }
        const snap = await db
          .collection('projects')
          .where('orgId', '==', req.params.orgId)
          .orderBy('createdAt', 'asc')
          .get();
        const projects = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate?.()?.toISOString(),
        }));
        res.json({ success: true, data: projects });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
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
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }

        // Check unique key within org
        const existing = await db
          .collection('projects')
          .where('orgId', '==', req.params.orgId)
          .where('key', '==', parsed.data.key)
          .get();
        if (!existing.empty) {
          res.status(409).json({
            success: false,
            error: { code: 'KEY_TAKEN', message: `Project key '${parsed.data.key}' already exists in this org.` },
          });
          return;
        }

        const id = uuidv4();
        const now = Timestamp.now();
        const data = {
          orgId: req.params.orgId,
          key: parsed.data.key,
          name: parsed.data.name,
          description: parsed.data.description ?? '',
          createdAt: now,
        };
        await db.collection('projects').doc(id).set(data);
        res.status(201).json({
          success: true,
          data: { id, ...data, createdAt: now.toDate().toISOString() },
        });
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
        const doc = await db.collection('projects').doc(req.params.projectId).get();
        if (!doc.exists) {
          res.status(404).json({ success: false, error: { message: 'Project not found' } });
          return;
        }
        const d = doc.data()!;
        res.json({
          success: true,
          data: {
            id: doc.id,
            ...d,
            createdAt: (d.createdAt as Timestamp)?.toDate?.()?.toISOString(),
          },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /projects/:projectId/backlog
   * Returns tasks not assigned to any active sprint.
   */
  router.get(
    '/projects/:projectId/backlog',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        // Get all tasks in project with status 'backlog'
        const taskSnap = await db
          .collection('tasks')
          .where('projectId', '==', req.params.projectId)
          .where('status', '==', 'backlog')
          .get();

        const tasks = taskSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate?.()?.toISOString(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate?.()?.toISOString(),
          };
        });
        res.json({ success: true, data: tasks });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
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
        const snap = await db
          .collection('epics')
          .where('projectId', '==', req.params.projectId)
          .get();
        const epics = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate?.()?.toISOString(),
        }));
        res.json({ success: true, data: epics });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
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
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        const id = uuidv4();
        const now = Timestamp.now();
        const data = {
          projectId: req.params.projectId,
          title: parsed.data.title,
          goal: parsed.data.goal ?? '',
          color: parsed.data.color,
          status: 'open',
          createdAt: now,
        };
        await db.collection('epics').doc(id).set(data);
        res.status(201).json({
          success: true,
          data: { id, ...data, createdAt: now.toDate().toISOString() },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  return router;
}
