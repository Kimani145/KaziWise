import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, TestContext } from './helpers.js';
import { withTenantContext } from '../src/db/tenant.js';
import { AudienceType, CourseStatus } from '@prisma/client';

describe('RBAC Route Matrix (3 Roles × Protected Routes)', () => {
  let ctx: TestContext;
  let testCourseId: string;
  let testCampaignId: string;
  let testAssignmentId: string;

  beforeAll(async () => {
    ctx = await setupTestEnvironment();

    // Create a published course and draft campaign in Org A
    await withTenantContext(ctx.orgA.id, async (tx) => {
      const course = await tx.course.create({
        data: {
          organisationId: ctx.orgA.id,
          title: 'RBAC Test Course',
          description: 'Description',
          status: CourseStatus.PUBLISHED,
          courseVersion: 1,
        },
      });
      testCourseId = course.id;

      const campaign = await tx.campaign.create({
        data: {
          organisationId: ctx.orgA.id,
          courseId: course.id,
          name: 'RBAC Campaign',
          audienceType: AudienceType.ALL_EMPLOYEES,
          passMark: 80,
          deadline: new Date(Date.now() + 86400000),
        },
      });
      testCampaignId = campaign.id;

      const assignment = await tx.assignment.create({
        data: {
          campaignId: campaign.id,
          userId: ctx.orgA.learner3.id,
          deadline: campaign.deadline,
          courseVersion: 1,
        },
      });
      testAssignmentId = assignment.id;
    });
  });

  describe('ORG_ADMIN Role', () => {
    const getHeaders = () => ({ authorization: `Bearer ${ctx.orgA.admin.token}` });

    it('can access employee management (GET & POST /employees)', async () => {
      const getRes = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/employees',
        headers: getHeaders(),
      });
      expect(getRes.statusCode).toBe(200);

      const postRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/employees',
        headers: getHeaders(),
        payload: {
          name: 'New Worker',
          email: 'newworker@acme.com',
          employeeNumber: 'EMP-NEW-01',
          departmentId: ctx.orgA.department1.id,
        },
      });
      expect(postRes.statusCode).toBe(201);
    });

    it('can create departments (POST /departments)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/departments',
        headers: getHeaders(),
        payload: { name: 'Finance' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('can author courses (POST /courses)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: getHeaders(),
        payload: { title: 'Finance 101', description: 'Basics' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('can manage campaigns (POST /campaigns)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/campaigns',
        headers: getHeaders(),
        payload: {
          name: 'Finance Campaign',
          courseId: testCourseId,
          audienceType: AudienceType.ALL_EMPLOYEES,
          deadline: new Date(Date.now() + 86400000).toISOString(),
          passMark: 75,
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it('can launch campaigns (POST /campaigns/:id/launch)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/v1/campaigns/${testCampaignId}/launch`,
        headers: getHeaders(),
      });
      // Allowed (returns 200)
      expect(res.statusCode).toBe(200);
    });

    it('can view org-wide reports (GET /reports/assignments)', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/reports/assignments',
        headers: getHeaders(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().summary).toBeDefined();
    });

    it('can send reminders (POST /assignments/:id/remind)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/v1/assignments/${testAssignmentId}/remind`,
        headers: getHeaders(),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('MANAGER Role', () => {
    const getHeaders = () => ({ authorization: `Bearer ${ctx.orgA.manager.token}` });

    it('is forbidden from employee management (403 on /employees)', async () => {
      const getRes = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/employees',
        headers: getHeaders(),
      });
      expect(getRes.statusCode).toBe(403);

      const postRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/employees',
        headers: getHeaders(),
        payload: { name: 'Unauthorized' },
      });
      expect(postRes.statusCode).toBe(403);
    });

    it('is forbidden from creating departments (403 on POST /departments)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/departments',
        headers: getHeaders(),
        payload: { name: 'Illegal Dept' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('is forbidden from authoring courses (403 on POST /courses)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: getHeaders(),
        payload: { title: 'Illegal Course', description: 'Desc' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('is forbidden from managing and launching campaigns (403 on /campaigns)', async () => {
      const postRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/campaigns',
        headers: getHeaders(),
        payload: { name: 'Illegal Camp' },
      });
      expect(postRes.statusCode).toBe(403);

      const launchRes = await ctx.app.inject({
        method: 'POST',
        url: `/api/v1/campaigns/${testCampaignId}/launch`,
        headers: getHeaders(),
      });
      expect(launchRes.statusCode).toBe(403);
    });

    it('can view team reports (GET /reports/assignments returns 200, row-scoped to direct reports)', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/reports/assignments',
        headers: getHeaders(),
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.summary).toBeDefined();
      // All returned rows must have managerId = manager.id (Evan reports to Bob)
      for (const row of data.rows) {
        expect(row.learnerId).toBe(ctx.orgA.learner3.id);
      }
    });

    it('can send reminders to their direct reports', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/v1/assignments/${testAssignmentId}/remind`,
        headers: getHeaders(),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('LEARNER Role', () => {
    const getHeaders = () => ({ authorization: `Bearer ${ctx.orgA.learner1.token}` });

    it('is forbidden from employee management (403)', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/employees',
        headers: getHeaders(),
      });
      expect(res.statusCode).toBe(403);
    });

    it('is forbidden from department management (403)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/departments',
        headers: getHeaders(),
        payload: { name: 'Learner Dept' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('is forbidden from authoring courses (403)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: getHeaders(),
        payload: { title: 'Learner Course', description: 'Desc' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('is forbidden from campaigns management and launch (403)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/campaigns',
        headers: getHeaders(),
        payload: { name: 'Learner Campaign' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('is forbidden from reports (403)', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/reports/assignments',
        headers: getHeaders(),
      });
      expect(res.statusCode).toBe(403);
    });

    it('is forbidden from sending reminders (403)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/v1/assignments/${testAssignmentId}/remind`,
        headers: getHeaders(),
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
