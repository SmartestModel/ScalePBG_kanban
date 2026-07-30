import { Request, Response, NextFunction } from 'express';
import { getAuth } from '../firebase/admin';
import { IOrgRepository } from '../interfaces/repositories';
import { AuthenticatedUser } from '../types/index';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Validates Firebase ID token from Authorization Bearer header.
 * Attaches decoded user to req.user.
 *
 * When USE_MOCK=true, skips token validation and injects a
 * hardcoded demo user for every request.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // ── Mock bypass ─────────────────────────────────────────────
  if (process.env.USE_MOCK === 'true') {
    req.user = {
      uid: 'demo-user-1',
      email: 'demo@example.com',
      name: 'Demo User',
      avatarUrl: undefined,
    };
    next();
    return;
  }

  // ── Production: validate Firebase ID token ───────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Missing or invalid Authorization header.',
      },
    });
    return;
  }

  const token = authHeader.slice(7);
  getAuth()
    .verifyIdToken(token)
    .then((decoded) => {
      req.user = {
        uid: decoded.uid,
        email: decoded.email ?? '',
        name: decoded.name ?? decoded.email ?? 'Unknown',
        avatarUrl: decoded.picture,
      };
      next();
    })
    .catch(() => {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Firebase ID token is expired or invalid.',
        },
      });
    });
}

/**
 * Middleware factory that resolves and attaches the user's role
 * within a specific org (from route param :orgId).
 */
export function withOrgRole(orgRepo: IOrgRepository) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED' } });
      return;
    }

    const orgId = req.params.orgId;
    if (!orgId) {
      next();
      return;
    }

    try {
      const member = await orgRepo.getMember(orgId, req.user.uid);
      if (member) {
        req.user.role = member.role;
        req.user.orgId = orgId;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
