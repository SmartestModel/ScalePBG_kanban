import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import {
  IAccessRequestRepository,
  IOrgRepository,
} from '../interfaces/repositories';
import { assertCan } from '../auth/rbac';
import { withOrgRole } from '../auth/middleware';

const CreateRequestSchema = z.object({
  orgId: z.string(),
});

const ReviewRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export function buildAccessRequestRouter(
  accessRequestRepo: IAccessRequestRepository,
  orgRepo: IOrgRepository
): Router {
  const router = Router();

  /**
   * POST /access-requests
   * Any authenticated user can request access to an org by orgId.
   */
  router.post(
    '/',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = CreateRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }

        const org = await orgRepo.findById(parsed.data.orgId);
        if (!org) {
          res.status(404).json({
            success: false,
            error: { message: 'Organization not found.' },
          });
          return;
        }

        // Check if already a member
        const existingMember = await orgRepo.getMember(
          parsed.data.orgId,
          req.user!.uid
        );
        if (existingMember) {
          res.status(409).json({
            success: false,
            error: {
              code: 'ALREADY_MEMBER',
              message: 'You are already a member of this organization.',
            },
          });
          return;
        }

        const request = await accessRequestRepo.create({
          orgId: parsed.data.orgId,
          orgName: org.name,
          userId: req.user!.uid,
          userEmail: req.user!.email,
          userName: req.user!.name,
          userAvatarUrl: req.user!.avatarUrl,
        });

        res.status(201).json({ success: true, data: request });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * GET /access-requests/my
   * Returns all access requests made by the current user.
   */
  router.get(
    '/my',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const requests = await accessRequestRepo.findByUser(req.user!.uid);
        res.json({ success: true, data: requests });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ success: false, error: { message } });
      }
    }
  );

  /**
   * PATCH /access-requests/:requestId
   * Approve or reject an access request. Admin only.
   * On approval, adds the user as a member of the org.
   */
  router.patch(
    '/:requestId',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = ReviewRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
          });
          return;
        }

        const accessRequest = await accessRequestRepo.findById(
          req.params.requestId
        );
        if (!accessRequest) {
          res.status(404).json({
            success: false,
            error: { message: 'Access request not found.' },
          });
          return;
        }

        // Check admin permission for the org in question
        const member = await orgRepo.getMember(
          accessRequest.orgId,
          req.user!.uid
        );
        if (!member) {
          res.status(403).json({
            success: false,
            error: {
              code: 'NOT_MEMBER',
              message: 'You are not a member of this organization.',
            },
          });
          return;
        }

        // Temporarily attach role for RBAC check
        req.user!.role = member.role;
        assertCan(req.user!, 'access_request:review');

        const updated = await accessRequestRepo.updateStatus(
          req.params.requestId,
          parsed.data.status,
          req.user!.uid
        );

        // If approved, add user to org as member
        if (parsed.data.status === 'approved') {
          await orgRepo.addMember(
            accessRequest.orgId,
            accessRequest.userId,
            'member'
          );
        }

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

  return router;
}
