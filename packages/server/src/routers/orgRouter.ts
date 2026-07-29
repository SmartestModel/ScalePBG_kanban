import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, withOrgRole } from '../auth/middleware';
import { assertCan } from '../auth/rbac';
import {
  IOrgRepository,
  IAccessRequestRepository,
} from '../interfaces/repositories';

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
});

const UpdateMemberSchema = z.object({
  role: z.enum(['admin', 'lead', 'member']),
});

export function buildOrgRouter(
  orgRepo: IOrgRepository,
  accessRequestRepo: IAccessRequestRepository
): Router {
  const router = Router();
  const orgRoleMiddleware = withOrgRole(orgRepo);

  /**
   * POST /orgs
   * Creates a new organization. The creator becomes the admin.
   */
  router.post(
    '/',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = CreateOrgSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }

        // Check slug uniqueness
        const existing = await orgRepo.findBySlug(parsed.data.slug);
        if (existing) {
          res.status(409).json({
            success: false,
            error: {
              code: 'SLUG_TAKEN',
              message: `Organization slug '${parsed.data.slug}' is already taken.`,
            },
          });
          return;
        }

        const org = await orgRepo.create(
          { name: parsed.data.name, slug: parsed.data.slug, ownerId: req.user!.uid },
          req.user!.uid
        );

        res.status(201).json({ success: true, data: org });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /orgs/search?slug=xxx
   * Public-ish endpoint to look up an org by slug (for access requests).
   */
  router.get(
    '/search',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const slug = req.query.slug as string;
      if (!slug) {
        res.status(400).json({
          success: false,
          error: { message: 'slug query parameter is required' },
        });
        return;
      }
      const org = await orgRepo.findBySlug(slug);
      if (!org) {
        res.status(404).json({ success: false, error: { message: 'Org not found' } });
        return;
      }
      // Return minimal info for discovery
      res.json({ success: true, data: { id: org.id, name: org.name, slug: org.slug } });
    }
  );

  /**
   * GET /orgs/:orgId
   */
  router.get(
    '/:orgId',
    requireAuth,
    orgRoleMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.user?.role) {
          res.status(403).json({ success: false, error: { code: 'NOT_MEMBER' } });
          return;
        }
        const org = await orgRepo.findById(req.params.orgId);
        if (!org) {
          res.status(404).json({ success: false, error: { message: 'Org not found' } });
          return;
        }
        res.json({ success: true, data: org });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /orgs/:orgId/members
   */
  router.get(
    '/:orgId/members',
    requireAuth,
    orgRoleMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.user?.role) {
          res.status(403).json({ success: false, error: { code: 'NOT_MEMBER' } });
          return;
        }
        const members = await orgRepo.getMembers(req.params.orgId);
        res.json({ success: true, data: members });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * PATCH /orgs/:orgId/members/:uid
   * Update a member's role. Admin only.
   */
  router.patch(
    '/:orgId/members/:uid',
    requireAuth,
    orgRoleMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        assertCan(req.user!, 'org:invite');
        const parsed = UpdateMemberSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }
        await orgRepo.updateMemberRole(
          req.params.orgId,
          req.params.uid,
          parsed.data.role
        );
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
   * GET /orgs/:orgId/access-requests
   * Returns pending requests for an org. Admin only.
   */
  router.get(
    '/:orgId/access-requests',
    requireAuth,
    orgRoleMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        assertCan(req.user!, 'access_request:review');
        const status = req.query.status as string | undefined;
        const requests = await accessRequestRepo.findByOrg(
          req.params.orgId,
          status as 'pending' | 'approved' | 'rejected' | undefined
        );
        res.json({ success: true, data: requests });
      } catch (err: unknown) {
        const e = err as { code?: number; message?: string };
        res.status(e.code ?? 500).json({
          success: false,
          error: { message: e.message ?? 'Unknown error' },
        });
      }
    }
  );

  return router;
}
