import { Role } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';

export type Action =
  | 'manageEmployees'
  | 'manageDepartments'
  | 'authorCourses'
  | 'publishCourses'
  | 'manageCampaigns'
  | 'launchCampaigns'
  | 'viewOrgReports'
  | 'viewTeamReports'
  | 'sendReminders'
  | 'manageSuperAdmin';

export interface AuthUser {
  id: string;
  organisationId: string;
  email: string;
  role: Role;
  name: string;
  departmentId: string;
  managerId?: string | null;
}

const PERMISSIONS_BY_ROLE: Record<Role, readonly Action[]> = {
  SUPER_ADMIN: [
    'manageSuperAdmin',
    'manageEmployees',
    'manageDepartments',
    'authorCourses',
    'publishCourses',
    'manageCampaigns',
    'launchCampaigns',
    'viewOrgReports',
    'viewTeamReports',
    'sendReminders',
  ],
  ORG_ADMIN: [
    'manageEmployees',
    'manageDepartments',
    'authorCourses',
    'publishCourses',
    'manageCampaigns',
    'launchCampaigns',
    'viewOrgReports',
    'viewTeamReports',
    'sendReminders',
  ],
  MANAGER: [
    'viewTeamReports',
    'sendReminders',
  ],
  LEARNER: [],
};

/**
 * Single, authoritative RBAC policy check.
 * 
 * Non-negotiable principle 2.2:
 * Every mutating route and every sensitive read route calls this function.
 * No route decides authorization by switching on user.role inline.
 */
export function can(
  user: { role: Role; id?: string; organisationId?: string } | null | undefined,
  action: Action,
  resource?: { organisationId?: string; managerId?: string | null; userId?: string }
): boolean {
  if (!user || !user.role) {
    return false;
  }

  // Verify resource tenant boundary if a resource is passed
  if (resource && resource.organisationId && user.organisationId) {
    if (resource.organisationId !== user.organisationId) {
      return false;
    }
  }

  const allowedActions = PERMISSIONS_BY_ROLE[user.role];
  if (!allowedActions) {
    return false;
  }

  return allowedActions.includes(action);
}

/**
 * Fastify preHandler hook generator that checks can(req.user, action) at the route boundary.
 */
export function requirePermission(action: Action) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (!can(user, action)) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: `User lacks required permission: ${action}`,
      });
    }
  };
}
