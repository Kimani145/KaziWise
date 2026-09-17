import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, TestContext } from './helpers.js';
import { withBypassRls, withTenantContext } from '../src/db/tenant.js';
import { AudienceType, CourseStatus } from '@prisma/client';
import ExcelJS from 'exceljs';

describe('Features Suite: Import, Certificate Verification, Reports & Late Completion', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestEnvironment();
  });

  it('FR-008: Employee CSV import returns detailed imported and rejected rows', async () => {
    const csvContent = `name,email,employeeNumber,department,role
Good Employee 1,good1@acme.com,EMP-CSV-1,Engineering,LEARNER
Good Employee 2,good2@acme.com,EMP-CSV-2,Marketing,MANAGER
Invalid Email Guy,bademail,EMP-CSV-3,Engineering,LEARNER
Missing Dept Guy,nodept@acme.com,EMP-CSV-4,,LEARNER
Duplicate Email Guy,${ctx.orgA.admin.email},EMP-CSV-5,Engineering,LEARNER`;

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/employees/import',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: { csvContent },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.imported).toBeDefined();
    expect(body.rejected).toBeDefined();

    // 2 valid employees imported
    expect(body.imported.length).toBe(2);
    expect(body.imported[0].email).toBe('good1@acme.com');
    expect(body.imported[1].email).toBe('good2@acme.com');

    // 3 rejected employees with exact rows and reasons
    expect(body.rejected.length).toBe(3);
    const reasons = body.rejected.map((r: any) => r.reason);
    expect(reasons.some((r: string) => r.includes('Invalid email'))).toBe(true);
    expect(reasons.some((r: string) => r.includes('Missing required field'))).toBe(true);
    expect(reasons.some((r: string) => r.includes('already in use'))).toBe(true);
  });

  it('FR-008: Employee Excel (XLSX) import works seamlessly', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Employees');
    sheet.columns = [
      { header: 'name', key: 'name' },
      { header: 'email', key: 'email' },
      { header: 'employeeNumber', key: 'employeeNumber' },
      { header: 'department', key: 'department' },
      { header: 'role', key: 'role' },
    ];
    sheet.addRow({
      name: 'Excel Worker',
      email: 'excelworker@acme.com',
      employeeNumber: 'EMP-XLS-1',
      department: 'Engineering',
      role: 'LEARNER',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/employees/import',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        base64Data,
        format: 'xlsx',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.imported.length).toBe(1);
    expect(body.imported[0].email).toBe('excelworker@acme.com');
  });

  it('Public Certificate Verification: GET /certificates/:id/verify returns authentic data without PII leakage', async () => {
    // Create course, campaign, assignment, pass it, issue certificate
    const { course, campaign, assignment, certificate } = await withBypassRls(async (tx) => {
      const c = await tx.course.create({
        data: {
          organisationId: ctx.orgA.id,
          title: 'Public Verification Course',
          description: 'Desc',
          status: CourseStatus.PUBLISHED,
          certificateEnabled: true,
          courseVersion: 1,
        },
      });
      const camp = await tx.campaign.create({
        data: {
          organisationId: ctx.orgA.id,
          courseId: c.id,
          name: 'Cert Campaign',
          audienceType: AudienceType.ALL_EMPLOYEES,
          deadline: new Date(Date.now() + 86400000),
          passMark: 80,
          certificateEnabled: true,
        },
      });
      const a = await tx.assignment.create({
        data: {
          campaignId: camp.id,
          userId: ctx.orgA.learner1.id,
          status: 'PASSED',
          score: 95,
          courseVersion: 1,
          deadline: camp.deadline,
        },
      });
      const cert = await tx.certificate.create({
        data: {
          assignmentId: a.id,
          userId: ctx.orgA.learner1.id,
          courseId: c.id,
          courseVersion: 1,
          score: 95,
          certificateNumber: 'CERT-VERIFY-123',
          verificationCode: 'VERIFY999',
          completionDate: new Date(),
          completedLate: false,
        },
      });
      return { course: c, campaign: camp, assignment: a, certificate: cert };
    });

    // Public request (no Authorization header at all!)
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/certificates/${certificate.verificationCode}/verify`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(true);
    expect(body.certificateNumber).toBe('CERT-VERIFY-123');
    expect(body.learnerName).toBe('Charlie Learner 1');
    expect(body.courseTitle).toBe('Public Verification Course');
    expect(body.completionDate).toBeDefined();
    expect(body.completedLate).toBe(false);

    // Assert NO private PII leaked
    expect(body.email).toBeUndefined();
    expect(body.score).toBeUndefined();
    expect(body.answers).toBeUndefined();
    expect(body.passwordHash).toBeUndefined();
  });

  it('FR-020: Late completion sets completedLateAt on assignment and completedLate on certificate', async () => {
    // Create course and campaign with PAST deadline
    const { course, campaign, assignment } = await withBypassRls(async (tx) => {
      const c = await tx.course.create({
        data: {
          organisationId: ctx.orgA.id,
          title: 'Late Course',
          description: 'Desc',
          status: CourseStatus.PUBLISHED,
          certificateEnabled: true,
          courseVersion: 1,
          modules: {
            create: [
              {
                title: 'M1',
                order: 1,
                lessons: {
                  create: [{ title: 'L1', order: 1, required: true }],
                },
              },
            ],
          },
          questions: {
            create: [
              {
                text: 'Q1',
                order: 1,
                options: {
                  create: [
                    { text: 'Correct', isCorrect: true },
                    { text: 'Wrong', isCorrect: false },
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

      // Past deadline (1 day ago)
      const pastDate = new Date(Date.now() - 86400000);

      const camp = await tx.campaign.create({
        data: {
          organisationId: ctx.orgA.id,
          courseId: c.id,
          name: 'Late Campaign',
          audienceType: AudienceType.ALL_EMPLOYEES,
          deadline: pastDate,
          passMark: 50,
          certificateEnabled: true,
        },
      });

      const a = await tx.assignment.create({
        data: {
          campaignId: camp.id,
          userId: ctx.orgA.learner1.id,
          status: 'IN_PROGRESS',
          courseVersion: 1,
          deadline: pastDate,
        },
      });

      return { course: c, campaign: camp, assignment: a };
    });

    const lessonId = course.modules[0].lessons[0].id;
    // Complete lesson
    await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assignment.id}/lessons/${lessonId}/complete`,
      headers: { authorization: `Bearer ${ctx.orgA.learner1.token}` },
    });

    // Submit passing attempt
    const optId = course.questions[0].options.find((o) => o.isCorrect)!.id;
    const attemptRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assignment.id}/attempts`,
      headers: { authorization: `Bearer ${ctx.orgA.learner1.token}` },
      payload: {
        answers: { [course.questions[0].id]: optId },
      },
    });

    expect(attemptRes.statusCode).toBe(200);
    const attemptData = attemptRes.json();
    expect(attemptData.passed).toBe(true);
    expect(attemptData.certificate).not.toBeNull();
    // Certificate completedLate must be true
    expect(attemptData.certificate.completedLate).toBe(true);

    // Assignment completedLateAt must be set
    const updatedAssignment = await withTenantContext(ctx.orgA.id, async (tx) => {
      return tx.assignment.findUnique({
        where: { id: assignment.id },
      });
    });
    expect(updatedAssignment?.completedLateAt).not.toBeNull();
  });

  it('Reports filtering and export (POST /reports/assignments/export)', async () => {
    const exportRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/reports/assignments/export',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        format: 'xlsx',
      },
    });

    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers['content-type']).toContain('spreadsheetml');
    expect(exportRes.rawPayload.length).toBeGreaterThan(100);
  });
});
