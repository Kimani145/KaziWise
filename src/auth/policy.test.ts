import { describe, it, expect } from 'vitest';
import { can, Action } from './policy.js';
import { Role } from '@prisma/client';

describe('RBAC policy function can()', () => {
  const orgAdmin = { id: 'u-1', organisationId: 'org-1', role: Role.ORG_ADMIN };
  const manager = { id: 'u-2', organisationId: 'org-1', role: Role.MANAGER };
  const learner = { id: 'u-3', organisationId: 'org-1', role: Role.LEARNER };
  const superAdmin = { id: 'u-0', organisationId: 'org-1', role: Role.SUPER_ADMIN };

  it('ORG_ADMIN has all administrative actions except manageSuperAdmin', () => {
    const orgAdminActions: Action[] = [
      'manageEmployees',
      'manageDepartments',
      'authorCourses',
      'publishCourses',
      'manageCampaigns',
      'launchCampaigns',
      'viewOrgReports',
      'viewTeamReports',
      'sendReminders',
    ];

    for (const action of orgAdminActions) {
      expect(can(orgAdmin, action)).toBe(true);
    }

    expect(can(orgAdmin, 'manageSuperAdmin')).toBe(false);
  });

  it('MANAGER has only viewTeamReports and sendReminders, strictly forbidden from campaign launch', () => {
    expect(can(manager, 'viewTeamReports')).toBe(true);
    expect(can(manager, 'sendReminders')).toBe(true);

    // QA bug: Manager privilege escalation must fail
    expect(can(manager, 'launchCampaigns')).toBe(false);
    expect(can(manager, 'manageCampaigns')).toBe(false);
    expect(can(manager, 'manageEmployees')).toBe(false);
    expect(can(manager, 'manageDepartments')).toBe(false);
    expect(can(manager, 'authorCourses')).toBe(false);
    expect(can(manager, 'publishCourses')).toBe(false);
    expect(can(manager, 'viewOrgReports')).toBe(false);
  });

  it('LEARNER has zero administrative permissions', () => {
    const allActions: Action[] = [
      'manageEmployees',
      'manageDepartments',
      'authorCourses',
      'publishCourses',
      'manageCampaigns',
      'launchCampaigns',
      'viewOrgReports',
      'viewTeamReports',
      'sendReminders',
      'manageSuperAdmin',
    ];

    for (const action of allActions) {
      expect(can(learner, action)).toBe(false);
    }
  });

  it('SUPER_ADMIN has manageSuperAdmin and admin capabilities', () => {
    expect(can(superAdmin, 'manageSuperAdmin')).toBe(true);
    expect(can(superAdmin, 'launchCampaigns')).toBe(true);
  });

  it('returns false for null or undefined user', () => {
    expect(can(null, 'launchCampaigns')).toBe(false);
    expect(can(undefined, 'launchCampaigns')).toBe(false);
  });

  it('enforces tenant boundary on resource when provided', () => {
    expect(can(orgAdmin, 'launchCampaigns', { organisationId: 'org-1' })).toBe(true);
    expect(can(orgAdmin, 'launchCampaigns', { organisationId: 'other-org' })).toBe(false);
  });
});
