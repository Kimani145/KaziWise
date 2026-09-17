import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, TestContext } from './helpers.js';
import { withBypassRls, withTenantContext } from '../src/db/tenant.js';
import { AudienceType, CourseStatus } from '@prisma/client';
import { prisma } from '../src/db/client.js';

describe('Adversarial QA Suite (Section 10 Definition of Done)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestEnvironment();
  });

  // Helper to create and publish a course with lessons and questions
  async function createPublishedCourse(
    orgId: string,
    title: string,
    passMark: number,
    certificateEnabledDefault: boolean
  ) {
    return withBypassRls(async (tx) => {
      const course = await tx.course.create({
        data: {
          organisationId: orgId,
          title,
          description: 'Description for ' + title,
          status: CourseStatus.PUBLISHED,
          certificateEnabled: certificateEnabledDefault,
          courseVersion: 1,
          modules: {
            create: [
              {
                title: 'Module 1',
                order: 1,
                lessons: {
                  create: [
                    {
                      title: 'Lesson 1',
                      order: 1,
                      required: true,
                    },
                  ],
                },
              },
            ],
          },
          questions: {
            create: [
              {
                text: 'Question 1: What is 2 + 2?',
                order: 1,
                options: {
                  create: [
                    { text: '4', isCorrect: true },
                    { text: '5', isCorrect: false },
                  ],
                },
              },
              {
                text: 'Question 2: What is 3 + 3?',
                order: 2,
                options: {
                  create: [
                    { text: '6', isCorrect: true },
                    { text: '7', isCorrect: false },
                  ],
                },
              },
            ],
          },
        },
        include: {
          modules: { include: { lessons: true } },
          questions: { include: { options: true } },
        },
      });
      return course;
    });
  }

  // 1. The wrong-assignment bug
  it('1. The wrong-assignment bug: simultaneous assignments are graded and issued independently', async () => {
    const course1 = await createPublishedCourse(ctx.orgA.id, 'Security Course A', 50, true);
    const course2 = await createPublishedCourse(ctx.orgA.id, 'Compliance Course B', 80, false);

    // Launch Campaign 1: passMark = 50, certificateEnabled = true, selected learner1
    const camp1Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        name: 'Campaign 1',
        courseId: course1.id,
        audienceType: AudienceType.SELECTED_EMPLOYEES,
        selectedUserIds: [ctx.orgA.learner1.id],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        passMark: 50,
        certificateEnabled: true,
      },
    });
    expect(camp1Res.statusCode).toBe(201);
    const camp1 = camp1Res.json();

    const launch1Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${camp1.id}/launch`,
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
    });
    expect(launch1Res.statusCode).toBe(200);

    // Launch Campaign 2: passMark = 80, certificateEnabled = false, selected learner1
    const camp2Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        name: 'Campaign 2',
        courseId: course2.id,
        audienceType: AudienceType.SELECTED_EMPLOYEES,
        selectedUserIds: [ctx.orgA.learner1.id],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        passMark: 80,
        certificateEnabled: false,
      },
    });
    expect(camp2Res.statusCode).toBe(201);
    const camp2 = camp2Res.json();

    const launch2Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${camp2.id}/launch`,
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
    });
    expect(launch2Res.statusCode).toBe(200);

    // Get learner1 assignments
    const myAssignmentsRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/me/assignments',
      headers: { authorization: `Bearer ${ctx.orgA.learner1.token}` },
    });
    expect(myAssignmentsRes.statusCode).toBe(200);
    const assignments = myAssignmentsRes.json();

    const assign1 = assignments.find((a: any) => a.campaignId === camp1.id);
    const assign2 = assignments.find((a: any) => a.campaignId === camp2.id);
    expect(assign1).toBeDefined();
    expect(assign2).toBeDefined();

    // Complete lesson on Assignment 1
    const lesson1Id = course1.modules[0].lessons[0].id;
    const comp1 = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assign1.id}/lessons/${lesson1Id}/complete`,
      headers: { authorization: `Bearer ${ctx.orgA.learner1.token}` },
    });
    expect(comp1.statusCode).toBe(200);

    // Complete lesson on Assignment 2
    const lesson2Id = course2.modules[0].lessons[0].id;
    const comp2 = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assign2.id}/lessons/${lesson2Id}/complete`,
      headers: { authorization: `Bearer ${ctx.orgA.learner1.token}` },
    });
    expect(comp2.statusCode).toBe(200);

    // Submit attempt on Assignment 1: 1 of 2 questions correct (50%)
    // Since passMark is 50, 50% >= 50% => PASSED!
    // And certificateEnabled is TRUE => certificate issued!
    const q1Correct = course1.questions[0].options.find((o) => o.isCorrect)!.id;
    const q2Wrong = course1.questions[1].options.find((o) => !o.isCorrect)!.id;

    const attempt1Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assign1.id}/attempts`,
      headers: { authorization: `Bearer ${ctx.orgA.learner1.token}` },
      payload: {
        answers: {
          [course1.questions[0].id]: q1Correct,
          [course1.questions[1].id]: q2Wrong,
        },
      },
    });

    expect(attempt1Res.statusCode).toBe(200);
    const attempt1 = attempt1Res.json();
    expect(attempt1.score).toBe(50);
    expect(attempt1.passed).toBe(true);
    expect(attempt1.certificate).not.toBeNull();
    expect(attempt1.certificate.certificateNumber).toBeDefined();

    // Submit attempt on Assignment 2: 1 of 2 questions correct (50%)
    // Since passMark is 80, 50% < 80% => FAILED!
    // And certificateEnabled is FALSE => NO certificate!
    const q1Correct2 = course2.questions[0].options.find((o) => o.isCorrect)!.id;
    const q2Wrong2 = course2.questions[1].options.find((o) => !o.isCorrect)!.id;

    const attempt2Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assign2.id}/attempts`,
      headers: { authorization: `Bearer ${ctx.orgA.learner1.token}` },
      payload: {
        answers: {
          [course2.questions[0].id]: q1Correct2,
          [course2.questions[1].id]: q2Wrong2,
        },
      },
    });

    expect(attempt2Res.statusCode).toBe(200);
    const attempt2 = attempt2Res.json();
    expect(attempt2.score).toBe(50);
    expect(attempt2.passed).toBe(false);
    expect(attempt2.certificate).toBeNull();

    // Verify in database: assign1 is PASSED with certificate, assign2 is FAILED without certificate
    const { dbAssign1, dbAssign2 } = await withTenantContext(ctx.orgA.id, async (tx) => {
      const a1 = await tx.assignment.findUnique({
        where: { id: assign1.id },
        include: { certificate: true, attempts: true },
      });
      const a2 = await tx.assignment.findUnique({
        where: { id: assign2.id },
        include: { certificate: true, attempts: true },
      });
      return { dbAssign1: a1, dbAssign2: a2 };
    });

    expect(dbAssign1?.status).toBe('PASSED');
    expect(dbAssign1?.certificate).not.toBeNull();
    expect(dbAssign1?.attempts.length).toBe(1);

    expect(dbAssign2?.status).toBe('FAILED');
    expect(dbAssign2?.certificate).toBeNull();
    expect(dbAssign2?.attempts.length).toBe(1);
  });

  // 2. The audience-ignored bug
  it('2. The audience-ignored bug: resolves correct counts per audience type', async () => {
    const course = await createPublishedCourse(ctx.orgA.id, 'Audience Test Course', 70, false);

    // Empty department test
    const emptyDept = await withTenantContext(ctx.orgA.id, async (tx) => {
      return tx.department.create({
        data: { organisationId: ctx.orgA.id, name: 'Empty Dept' },
      });
    });

    const emptyCampRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        name: 'Empty Dept Campaign',
        courseId: course.id,
        audienceType: AudienceType.DEPARTMENT,
        departmentId: emptyDept.id,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        passMark: 70,
      },
    });
    const emptyCamp = emptyCampRes.json();

    const emptyLaunchRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${emptyCamp.id}/launch`,
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
    });
    expect(emptyLaunchRes.statusCode).toBe(400);
    expect(emptyLaunchRes.json().error).toBe('NO_ELIGIBLE_LEARNERS');

    // Marketing Department campaign: exactly 1 active learner (Dana)
    const mktCampRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        name: 'Marketing Campaign',
        courseId: course.id,
        audienceType: AudienceType.DEPARTMENT,
        departmentId: ctx.orgA.department2.id,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        passMark: 70,
      },
    });
    const mktCamp = mktCampRes.json();

    const mktLaunchRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${mktCamp.id}/launch`,
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
    });
    expect(mktLaunchRes.statusCode).toBe(200);
    expect(mktLaunchRes.json().assignmentsCreated).toBe(1);

    // Two SELECTED_EMPLOYEES campaigns with different pairs
    const sel1Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        name: 'Selected Campaign 1',
        courseId: course.id,
        audienceType: AudienceType.SELECTED_EMPLOYEES,
        selectedUserIds: [ctx.orgA.learner1.id, ctx.orgA.learner2.id],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        passMark: 70,
      },
    });
    const sel1 = sel1Res.json();

    const launchSel1 = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${sel1.id}/launch`,
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
    });
    expect(launchSel1.statusCode).toBe(200);
    expect(launchSel1.json().assignmentsCreated).toBe(2);

    // Launch second selected campaign with only learner3
    const sel2Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        name: 'Selected Campaign 2',
        courseId: course.id,
        audienceType: AudienceType.SELECTED_EMPLOYEES,
        selectedUserIds: [ctx.orgA.learner3.id],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        passMark: 70,
      },
    });
    const sel2 = sel2Res.json();

    const launchSel2 = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${sel2.id}/launch`,
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
    });
    expect(launchSel2.statusCode).toBe(200);
    expect(launchSel2.json().assignmentsCreated).toBe(1);

    // Assert first campaign assignment count is completely unaffected
    const countSel1 = await withTenantContext(ctx.orgA.id, async (tx) => {
      return tx.assignment.count({
        where: { campaignId: sel1.id },
      });
    });
    expect(countSel1).toBe(2);
  });

  // 3. The manager-privilege-escalation bug
  it('3. The manager-privilege-escalation bug: manager token rejected with 403 on campaign launch', async () => {
    const course = await createPublishedCourse(ctx.orgA.id, 'Manager Escalation Test', 70, false);

    const campRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        name: 'Manager Target Campaign',
        courseId: course.id,
        audienceType: AudienceType.SELECTED_EMPLOYEES,
        selectedUserIds: [ctx.orgA.learner1.id],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        passMark: 70,
      },
    });
    const camp = campRes.json();

    // Attempt launch using MANAGER token
    const launchRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${camp.id}/launch`,
      headers: { authorization: `Bearer ${ctx.orgA.manager.token}` },
    });

    expect(launchRes.statusCode).toBe(403);
    expect(launchRes.json().error).toBe('FORBIDDEN');

    // Campaign must remain DRAFT
    const campDb = await withTenantContext(ctx.orgA.id, async (tx) => {
      return tx.campaign.findUnique({ where: { id: camp.id } });
    });
    expect(campDb?.status).toBe('DRAFT');
  });

  // 4. The post-pass mutation bug
  it('4. The post-pass mutation bug: once PASSED, further mutations rejected with 409', async () => {
    const course = await createPublishedCourse(ctx.orgA.id, 'Post-Pass Protection Course', 50, true);

    const campRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        name: 'Post-Pass Campaign',
        courseId: course.id,
        audienceType: AudienceType.SELECTED_EMPLOYEES,
        selectedUserIds: [ctx.orgA.learner2.id],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        passMark: 50,
        certificateEnabled: true,
      },
    });
    const camp = campRes.json();

    await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${camp.id}/launch`,
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
    });

    const myAssignmentsRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/me/assignments',
      headers: { authorization: `Bearer ${ctx.orgA.learner2.token}` },
    });
    const assignment = myAssignmentsRes.json().find((a: any) => a.campaignId === camp.id);
    const lessonId = course.modules[0].lessons[0].id;

    // Complete lesson
    await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assignment.id}/lessons/${lessonId}/complete`,
      headers: { authorization: `Bearer ${ctx.orgA.learner2.token}` },
    });

    // Pass the assessment (100%)
    const q1Correct = course.questions[0].options.find((o) => o.isCorrect)!.id;
    const q2Correct = course.questions[1].options.find((o) => o.isCorrect)!.id;

    const passRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assignment.id}/attempts`,
      headers: { authorization: `Bearer ${ctx.orgA.learner2.token}` },
      payload: {
        answers: {
          [course.questions[0].id]: q1Correct,
          [course.questions[1].id]: q2Correct,
        },
      },
    });
    expect(passRes.statusCode).toBe(200);
    expect(passRes.json().status).toBe('PASSED');

    const certBefore = await withTenantContext(ctx.orgA.id, async (tx) => {
      return tx.certificate.findUnique({
        where: { assignmentId: assignment.id },
      });
    });
    expect(certBefore).not.toBeNull();

    // ATTEMPT 1 AFTER PASS: Complete lesson again
    const lessonAfterPass = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assignment.id}/lessons/${lessonId}/complete`,
      headers: { authorization: `Bearer ${ctx.orgA.learner2.token}` },
    });
    expect(lessonAfterPass.statusCode).toBe(409);
    expect(lessonAfterPass.json().error).toBe('ASSIGNMENT_ALREADY_PASSED');

    // ATTEMPT 2 AFTER PASS: Submit assessment again
    const attemptAfterPass = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assignment.id}/attempts`,
      headers: { authorization: `Bearer ${ctx.orgA.learner2.token}` },
      payload: {
        answers: {
          [course.questions[0].id]: q1Correct,
          [course.questions[1].id]: q2Correct,
        },
      },
    });
    expect(attemptAfterPass.statusCode).toBe(409);
    expect(attemptAfterPass.json().error).toBe('ASSIGNMENT_ALREADY_PASSED');

    // Assert assignment and certificate remain unchanged
    const { assignDb, certAfter } = await withTenantContext(ctx.orgA.id, async (tx) => {
      const a = await tx.assignment.findUnique({
        where: { id: assignment.id },
        include: { attempts: true },
      });
      const c = await tx.certificate.findUnique({
        where: { assignmentId: assignment.id },
      });
      return { assignDb: a, certAfter: c };
    });

    expect(assignDb?.status).toBe('PASSED');
    expect(assignDb?.attempts.length).toBe(1); // no extra attempt created
    expect(certAfter?.id).toBe(certBefore?.id);
    expect(certAfter?.verificationCode).toBe(certBefore?.verificationCode);
  });

  // 5. The organisation-isolation bug
  it('5. The organisation-isolation bug: Org A cannot read or mutate Org B resources (app layer + RLS)', async () => {
    // Org B creates a course
    const courseB = await createPublishedCourse(ctx.orgB.id, 'Secret Org B Course', 60, false);

    // 1. Org A Admin attempts to GET Org B course via API
    const getRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/courses/${courseB.id}`,
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
    });
    expect(getRes.statusCode).toBe(404);

    // 2. Org A Admin attempts to PATCH Org B course via API
    const patchRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/courses/${courseB.id}`,
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: { title: 'Hacked Title' },
    });
    expect(patchRes.statusCode).toBe(404);

    // 3. Database Engine RLS Test: Even with hypothetically removed app WHERE clause,
    // when running inside Org A context, PostgreSQL RLS returns 0 rows for Org B.
    const rlsQueryResult = await withTenantContext(ctx.orgA.id, async (tx) => {
      // Direct raw select by ID without organisationId filter in WHERE
      return tx.course.findUnique({
        where: { id: courseB.id },
      });
    });

    // PostgreSQL RLS hides the row completely from Org A
    expect(rlsQueryResult).toBeNull();
  });
});
