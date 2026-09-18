import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, TestContext } from './helpers.js';
import { withBypassRls, withTenantContext } from '../src/db/tenant.js';
import { AudienceType, CourseStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PDFParse } from 'pdf-parse';

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

  it('P-01: Reports PDF export returns genuine %PDF- bytes and extracts table data', async () => {
    const exportRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/reports/assignments/export',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        format: 'pdf',
      },
    });

    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers['content-type']).toBe('application/pdf');
    expect(exportRes.headers['content-disposition']).toContain('.pdf');

    const pdfBuffer = exportRes.rawPayload;
    // Verify magic bytes: %PDF-
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // Extract text and assert known data appears
    const parser = new PDFParse({ data: pdfBuffer });
    const parsed = await parser.getText();
    expect(parsed.text).toContain('KaziWise Training Compliance Report');
    expect(parsed.text).toContain(ctx.orgA.learner1.email);
  });

  it('P-04: Assignment STARTED state transitions on view, IN_PROGRESS on first lesson, COMPLETED when all required lessons done', async () => {
    // 1. Create a course with 2 required lessons and a campaign
    const { course, campaign, assignment } = await withBypassRls(async (tx) => {
      const c = await tx.course.create({
        data: {
          organisationId: ctx.orgA.id,
          title: 'P-04 State Machine Course',
          description: 'Testing STARTED state transition',
          status: CourseStatus.PUBLISHED,
          certificateEnabled: false,
          courseVersion: 1,
          modules: {
            create: [
              {
                title: 'Module 1',
                order: 1,
                lessons: {
                  create: [
                    { title: 'Lesson 1 (Req)', order: 1, required: true },
                    { title: 'Lesson 2 (Req)', order: 2, required: true },
                  ],
                },
              },
            ],
          },
        },
        include: {
          modules: {
            include: { lessons: { orderBy: { order: 'asc' } } },
          },
        },
      });

      const camp = await tx.campaign.create({
        data: {
          organisationId: ctx.orgA.id,
          courseId: c.id,
          name: 'P-04 Campaign',
          audienceType: AudienceType.ALL_EMPLOYEES,
          deadline: new Date(Date.now() + 86400000),
          passMark: 80,
          certificateEnabled: false,
        },
      });

      const a = await tx.assignment.create({
        data: {
          campaignId: camp.id,
          userId: ctx.orgA.learner2.id,
          status: 'ASSIGNED',
          courseVersion: 1,
          deadline: camp.deadline,
        },
      });

      return { course: c, campaign: camp, assignment: a };
    });

    const lesson1Id = course.modules[0].lessons[0].id;
    const lesson2Id = course.modules[0].lessons[1].id;

    // Confirm initial state is ASSIGNED
    expect(assignment.status).toBe('ASSIGNED');

    // 2. Fetch assignment detail once as learner2: should transition to STARTED
    const getRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/me/assignments/${assignment.id}`,
      headers: { authorization: `Bearer ${ctx.orgA.learner2.token}` },
    });

    expect(getRes.statusCode).toBe(200);
    const detail = getRes.json();
    expect(detail.status).toBe('STARTED');

    // Verify persisted in DB as STARTED
    const dbAssignmentAfterGet = await withTenantContext(ctx.orgA.id, async (tx) => {
      return tx.assignment.findUnique({ where: { id: assignment.id } });
    });
    expect(dbAssignmentAfterGet?.status).toBe('STARTED');

    // 3. Complete first required lesson: should transition to IN_PROGRESS
    const comp1Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assignment.id}/lessons/${lesson1Id}/complete`,
      headers: { authorization: `Bearer ${ctx.orgA.learner2.token}` },
    });

    expect(comp1Res.statusCode).toBe(200);
    const comp1 = comp1Res.json();
    expect(comp1.currentStatus).toBe('IN_PROGRESS');
    expect(comp1.requiredCompleted).toBe(1);
    expect(comp1.totalRequired).toBe(2);

    // 4. Complete second required lesson: should transition to COMPLETED
    const comp2Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/me/assignments/${assignment.id}/lessons/${lesson2Id}/complete`,
      headers: { authorization: `Bearer ${ctx.orgA.learner2.token}` },
    });

    expect(comp2Res.statusCode).toBe(200);
    const comp2 = comp2Res.json();
    expect(comp2.currentStatus).toBe('COMPLETED');
    expect(comp2.requiredCompleted).toBe(2);
    expect(comp2.totalRequired).toBe(2);
  });

  it('P-03: Real file storage, object key scheme, signed URLs, cross-org access rejection, and expiration', async () => {
    // 1. Create a course with a content block in Org A
    const { course, campaign, assignment, contentBlock } = await withBypassRls(async (tx) => {
      const c = await tx.course.create({
        data: {
          organisationId: ctx.orgA.id,
          title: 'P-03 Media Course',
          description: 'Testing media signed URLs',
          status: CourseStatus.PUBLISHED,
          certificateEnabled: false,
          courseVersion: 1,
          modules: {
            create: [
              {
                title: 'Media Module',
                order: 1,
                lessons: {
                  create: [
                    {
                      title: 'Video Lesson',
                      order: 1,
                      required: true,
                      blocks: {
                        create: [
                          {
                            title: 'Company Intro Video',
                            type: 'VIDEO',
                            body: 'placeholder_key',
                            order: 1,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        include: {
          modules: {
            include: {
              lessons: {
                include: { blocks: true },
              },
            },
          },
        },
      });

      const camp = await tx.campaign.create({
        data: {
          organisationId: ctx.orgA.id,
          courseId: c.id,
          name: 'Media Campaign',
          audienceType: AudienceType.ALL_EMPLOYEES,
          deadline: new Date(Date.now() + 86400000),
          passMark: 80,
          certificateEnabled: false,
        },
      });

      const a = await tx.assignment.create({
        data: {
          campaignId: camp.id,
          userId: ctx.orgA.learner1.id,
          status: 'STARTED',
          courseVersion: 1,
          deadline: camp.deadline,
        },
      });

      const cb = c.modules[0].lessons[0].blocks[0];
      return { course: c, campaign: camp, assignment: a, contentBlock: cb };
    });

    const lessonId = course.modules[0].lessons[0].id;
    const blockId = contentBlock.id;

    // 2. Org A Admin signs upload for the content block
    const signRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/uploads/sign',
      headers: { authorization: `Bearer ${ctx.orgA.admin.token}` },
      payload: {
        filename: 'intro-video.mp4',
        contentType: 'video/mp4',
        fileSize: 1048576, // 1 MB
        contentBlockId: blockId,
      },
    });

    expect(signRes.statusCode).toBe(200);
    const signData = signRes.json();
    // Confirm key follows: {organisationId}/{contentBlockId}/{filename}
    expect(signData.key).toBe(`${ctx.orgA.id}/${blockId}/intro-video.mp4`);
    expect(signData.uploadUrl).toBeDefined();

    // 3. Upload video data to uploadUrl (PUT)
    const videoPayload = Buffer.from('FAKE_MP4_VIDEO_BINARY_DATA');
    const uploadRes = await ctx.app.inject({
      method: 'PUT',
      url: signData.uploadUrl,
      headers: { 'content-type': 'video/mp4' },
      payload: videoPayload,
    });
    expect(uploadRes.statusCode).toBe(200);

    // 4. Update ContentBlock.body to store the object key (not full URL)
    await withBypassRls(async (tx) => {
      await tx.contentBlock.update({
        where: { id: blockId },
        data: { body: signData.key },
      });
    });

    // 5. Learner with valid assignment requests signed URL for the block
    const getUrlRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/me/assignments/${assignment.id}/lessons/${lessonId}/blocks/${blockId}/url`,
      headers: { authorization: `Bearer ${ctx.orgA.learner1.token}` },
    });

    expect(getUrlRes.statusCode).toBe(200);
    const urlData = getUrlRes.json();
    expect(urlData.url).toContain(`/api/v1/uploads/storage/${signData.key}`);

    // Confirm playback / download works using the signed URL (no Bearer header needed)
    const mediaRes = await ctx.app.inject({
      method: 'GET',
      url: urlData.url,
    });
    expect(mediaRes.statusCode).toBe(200);
    expect(mediaRes.headers['content-type']).toBe('video/mp4');
    expect(mediaRes.rawPayload.toString()).toBe('FAKE_MP4_VIDEO_BINARY_DATA');

    // 6. Cross-org check: Learner in Org B tries to request signed URL for Org A block
    const crossOrgRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/me/assignments/${assignment.id}/lessons/${lessonId}/blocks/${blockId}/url`,
      headers: { authorization: `Bearer ${ctx.orgB.learner.token}` },
    });
    expect(crossOrgRes.statusCode).toBe(403);

    // 7. Verify expired signed URL fails with 403
    const expiredUrl = `/api/v1/uploads/storage/${signData.key}?token=sometoken&expires=${Date.now() - 1000}`;
    const expiredRes = await ctx.app.inject({
      method: 'GET',
      url: expiredUrl,
    });
    expect(expiredRes.statusCode).toBe(403);
  });
});
