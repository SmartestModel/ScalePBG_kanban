import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware';
import { IUserRepository } from '../interfaces/repositories';
import { IOrgRepository } from '../interfaces/repositories';

export function buildAuthRouter(
  userRepo: IUserRepository,
  orgRepo: IOrgRepository
): Router {
  const router = Router();

  /**
   * POST /auth/sync-profile
   * Called from client after every Firebase login to upsert the
   * user profile doc in Firestore and return current org membership.
   */
  router.post(
    '/sync-profile',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { uid, email, name, avatarUrl } = req.user!;
        const user = await userRepo.upsert({ id: uid, email, name, avatarUrl });
        // Find all orgs this user belongs to
        const orgs = await orgRepo.findByUser(uid);
        res.json({ success: true, data: { user, orgs } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /auth/me
   * Returns the current user's profile + org memberships.
   */
  router.get(
    '/me',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = await userRepo.findById(req.user!.uid);
        const orgs = await orgRepo.findByUser(req.user!.uid);
        res.json({ success: true, data: { user, orgs } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  return router;
}
