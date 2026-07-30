import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import {
  IStoryRepository,
  IProjectRepository,
  IOrgRepository,
} from '../interfaces/repositories';

const CreateStorySchema = z.object({
  projectId: z.string().min(1),
  epicId: z.string().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  storyPoints: z.number().min(0).default(0),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

const UpdateStorySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  epicId: z.string().nullable().optional(),
  storyPoints: z.number().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export function buildStoryRouter(
  storyRepo: IStoryRepository,
  projectRepo: IProjectRepository,
  orgRepo: IOrgRepository
): Router {
  const router = Router();

  /**
   * GET /projects/:projectId/stories
   */
  router.get(
    '/projects/:projectId/stories',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const stories = await storyRepo.findByProject(req.params.projectId);
        res.json({ success: true, data: stories });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * POST /stories
   */
  router.post(
    '/stories',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = CreateStorySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        const story = await storyRepo.create(parsed.data);
        res.status(201).json({ success: true, data: story });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /stories/:id
   */
  router.get(
    '/stories/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const story = await storyRepo.findById(req.params.id);
        if (!story) {
          res.status(404).json({ success: false, error: { message: 'Story not found' } });
          return;
        }
        res.json({ success: true, data: story });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * PATCH /stories/:id
   */
  router.patch(
    '/stories/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = UpdateStorySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        const safeChanges = {
          ...parsed.data,
          epicId: parsed.data.epicId === null ? undefined : parsed.data.epicId,
        };
        const updated = await storyRepo.update(req.params.id, safeChanges);
        res.json({ success: true, data: updated });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * DELETE /stories/:id
   */
  router.delete(
    '/stories/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        await storyRepo.delete(req.params.id);
        res.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  return router;
}
