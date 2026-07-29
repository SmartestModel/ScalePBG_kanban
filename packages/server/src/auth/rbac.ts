import { AuthenticatedUser, UserRole } from '../types/index';

export type Action =
  | 'org:update'
  | 'org:invite'
  | 'project:create'
  | 'project:delete'
  | 'sprint:create'
  | 'sprint:close'
  | 'sprint:add_items'
  | 'task:create'
  | 'task:assign'
  | 'task:edit'
  | 'task:delete'
  | 'metrics:view'
  | 'access_request:review';

/**
 * Central RBAC policy engine.
 * Returns true if the user is allowed to perform the given action.
 *
 * @param user - The authenticated user context (must have `role` set).
 * @param action - The action being attempted.
 * @param resourceOwnerId - Optional: the assigneeId/ownerId of the
 *   resource being acted upon (for member self-service checks).
 */
export function can(
  user: AuthenticatedUser,
  action: Action,
  resourceOwnerId?: string
): boolean {
  const role: UserRole = user.role ?? 'member';

  const isAdmin = role === 'admin';
  const isLeadOrAdmin = role === 'admin' || role === 'lead';

  switch (action) {
    case 'org:update':
    case 'org:invite':
    case 'project:create':
    case 'project:delete':
    case 'access_request:review':
      return isAdmin;

    case 'sprint:create':
    case 'sprint:close':
    case 'sprint:add_items':
    case 'task:assign':
    case 'task:delete':
    case 'metrics:view':
      return isLeadOrAdmin;

    case 'task:create':
      // All authenticated workspace members can create tasks
      return true;

    case 'task:edit':
      if (isLeadOrAdmin) return true;
      // Members can edit only tasks assigned to them
      return (
        resourceOwnerId !== undefined && user.uid === resourceOwnerId
      );

    default:
      return false;
  }
}

/**
 * Throws a 403 error object if the user cannot perform the action.
 * Designed to be used as a guard inside route handlers.
 */
export function assertCan(
  user: AuthenticatedUser,
  action: Action,
  resourceOwnerId?: string
): void {
  if (!can(user, action, resourceOwnerId)) {
    throw Object.assign(
      new Error(`Permission denied: '${action}' requires higher role.`),
      { code: 403, errorCode: 'PERMISSION_DENIED' }
    );
  }
}
