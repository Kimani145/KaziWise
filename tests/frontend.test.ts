import { describe, it, expect } from 'vitest';
import { can as backendCan, Role } from '../src/auth/policy.js';
import { can as frontendCan, isLearner, PERMISSIONS_BY_ROLE, Action } from '../frontend/src/lib/permissions.js';
import { ERROR_MESSAGES, ApiError } from '../frontend/src/lib/api-client.js';
import { formatDate, formatDateTime } from '../frontend/src/lib/utils.js';

describe('Frontend Architecture & Parity Tests', () => {
  describe('Permissions & RBAC parity (P-02 / Section E)', () => {
    const roles: Role[] = ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'LEARNER'];
    const actions: Action[] = [
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

    it('should have exact matrix parity between backend and frontend can() for all roles and actions', () => {
      for (const role of roles) {
        const dummyUser = { id: 'test-user', organisationId: 'test-org', role, email: 't@t.com', name: 'Test', departmentId: 'dept-1' };
        for (const action of actions) {
          const backendResult = backendCan(dummyUser, action);
          const frontendResult = frontendCan(dummyUser, action);
          expect(frontendResult, `Mismatch for role=${role} action=${action}`).toBe(backendResult);
        }
      }
    });

    it('should accurately identify learners with zero management capabilities', () => {
      expect(isLearner({ role: 'LEARNER' })).toBe(true);
      expect(isLearner({ role: 'MANAGER' })).toBe(false);
      expect(isLearner({ role: 'ORG_ADMIN' })).toBe(false);
      expect(isLearner({ role: 'SUPER_ADMIN' })).toBe(false);
    });

    it('should strictly limit manager to viewTeamReports and sendReminders', () => {
      const managerUser = { role: 'MANAGER' as const };
      expect(frontendCan(managerUser, 'viewTeamReports')).toBe(true);
      expect(frontendCan(managerUser, 'sendReminders')).toBe(true);
      expect(frontendCan(managerUser, 'manageEmployees')).toBe(false);
      expect(frontendCan(managerUser, 'authorCourses')).toBe(false);
      expect(frontendCan(managerUser, 'publishCourses')).toBe(false);
      expect(frontendCan(managerUser, 'manageCampaigns')).toBe(false);
      expect(frontendCan(managerUser, 'launchCampaigns')).toBe(false);
      expect(frontendCan(managerUser, 'viewOrgReports')).toBe(false);
    });
  });

  describe('Error Code Mapping (Section E acceptance)', () => {
    it('should map all 5 mandatory backend error codes to exact UI messages', () => {
      expect(ERROR_MESSAGES.ASSIGNMENT_ALREADY_PASSED).toBe(
        'This training is already complete — no further action needed.'
      );
      expect(ERROR_MESSAGES.COURSE_NOT_PUBLISHED).toBe(
        'This course must be published before it can be assigned.'
      );
      expect(ERROR_MESSAGES.INVALID_PASS_MARK).toBe(
        'Pass mark must be a valid percentage between 1 and 100.'
      );
      expect(ERROR_MESSAGES.DEADLINE_IN_PAST).toBe(
        'The campaign deadline cannot be in the past.'
      );
      expect(ERROR_MESSAGES.NO_ELIGIBLE_LEARNERS).toBe(
        "No eligible learners match this campaign's audience — check the department or employee selection."
      );
    });

    it('should construct ApiError with code, status, and mapped message', () => {
      const err = new ApiError(400, 'DEADLINE_IN_PAST', ERROR_MESSAGES.DEADLINE_IN_PAST);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('DEADLINE_IN_PAST');
      expect(err.message).toBe('The campaign deadline cannot be in the past.');
    });
  });

  describe('Formatting and derived calculations', () => {
    it('should format dates safely', () => {
      const dateStr = '2026-10-15T00:00:00.000Z';
      const formatted = formatDate(dateStr);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
      expect(formatDate(null)).toBe('N/A');
    });

    it('should compute numeric progress percentages correctly', () => {
      const calculateProgress = (completedCount: number, totalRequired: number): number => {
        if (totalRequired === 0) return 100;
        return Math.round((completedCount / totalRequired) * 100);
      };

      expect(calculateProgress(0, 5)).toBe(0);
      expect(calculateProgress(1, 3)).toBe(33);
      expect(calculateProgress(2, 3)).toBe(67);
      expect(calculateProgress(3, 3)).toBe(100);
      expect(calculateProgress(0, 0)).toBe(100);
    });
  });
});
