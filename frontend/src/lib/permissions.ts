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

export type Role = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MANAGER' | 'LEARNER';

export const PERMISSIONS_BY_ROLE: Record<Role, readonly Action[]> = {
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

export function can(
  userOrRole: Role | { role: Role } | null | undefined,
  action: Action
): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  const permissions = PERMISSIONS_BY_ROLE[role] || [];
  return permissions.includes(action);
}

export function isLearner(userOrRole: Role | { role: Role } | null | undefined): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  return (PERMISSIONS_BY_ROLE[role] || []).length === 0;
}

export function useCan(
  user: { role: Role } | null | undefined,
  action: Action
): boolean {
  return can(user, action);
}
