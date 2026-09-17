import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { prisma } from '../src/db/client.js';
import { hashPassword, signAccessToken } from '../src/auth/jwt.js';
import { AudienceType, CourseStatus, EmploymentStatus, Role } from '@prisma/client';
import { withBypassRls } from '../src/db/tenant.js';
import crypto from 'crypto';

export interface TestContext {
  app: FastifyInstance;
  orgA: {
    id: string;
    name: string;
    department1: { id: string; name: string };
    department2: { id: string; name: string };
    admin: { id: string; email: string; token: string };
    manager: { id: string; email: string; token: string };
    learner1: { id: string; email: string; token: string };
    learner2: { id: string; email: string; token: string };
    learner3: { id: string; email: string; token: string }; // reports to manager
    inactiveUser: { id: string; email: string };
  };
  orgB: {
    id: string;
    name: string;
    department: { id: string; name: string };
    admin: { id: string; email: string; token: string };
    learner: { id: string; email: string; token: string };
  };
}

export async function setupTestEnvironment(): Promise<TestContext> {
  const app = await buildApp();
  await app.ready();

  // Clean test database using withBypassRls
  await withBypassRls(async (tx) => {
    await tx.auditLog.deleteMany();
    await tx.certificate.deleteMany();
    await tx.attempt.deleteMany();
    await tx.lessonProgress.deleteMany();
    await tx.assignment.deleteMany();
    await tx.campaignSelectedUser.deleteMany();
    await tx.campaign.deleteMany();
    await tx.option.deleteMany();
    await tx.question.deleteMany();
    await tx.contentBlock.deleteMany();
    await tx.lesson.deleteMany();
    await tx.module.deleteMany();
    await tx.course.deleteMany();
    await tx.user.deleteMany();
    await tx.department.deleteMany();
    await tx.organisation.deleteMany();
  });

  const defaultPasswordHash = await hashPassword('Password123!');

  // Seed Org A and Org B
  const context = await withBypassRls(async (tx) => {
    const uid = crypto.randomUUID().slice(0, 8);

    // Org A
    const orgA = await tx.organisation.create({
      data: { name: `Acme Corp ${uid} (Org A)` },
    });

    const deptA1 = await tx.department.create({
      data: { organisationId: orgA.id, name: 'Engineering' },
    });
    const deptA2 = await tx.department.create({
      data: { organisationId: orgA.id, name: 'Marketing' },
    });

    // Org A Admin
    const adminA = await tx.user.create({
      data: {
        organisationId: orgA.id,
        departmentId: deptA1.id,
        name: 'Alice Admin',
        email: `admin-${uid}@acme.com`,
        employeeNumber: `EMP-A001-${uid}`,
        passwordHash: defaultPasswordHash,
        role: Role.ORG_ADMIN,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    // Org A Manager
    const managerA = await tx.user.create({
      data: {
        organisationId: orgA.id,
        departmentId: deptA1.id,
        name: 'Bob Manager',
        email: `manager-${uid}@acme.com`,
        employeeNumber: `EMP-A002-${uid}`,
        passwordHash: defaultPasswordHash,
        role: Role.MANAGER,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    // Org A Learner 1 (Engineering, no manager)
    const learnerA1 = await tx.user.create({
      data: {
        organisationId: orgA.id,
        departmentId: deptA1.id,
        name: 'Charlie Learner 1',
        email: `charlie-${uid}@acme.com`,
        employeeNumber: `EMP-A003-${uid}`,
        passwordHash: defaultPasswordHash,
        role: Role.LEARNER,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    // Org A Learner 2 (Marketing, no manager)
    const learnerA2 = await tx.user.create({
      data: {
        organisationId: orgA.id,
        departmentId: deptA2.id,
        name: 'Dana Learner 2',
        email: `dana-${uid}@acme.com`,
        employeeNumber: `EMP-A004-${uid}`,
        passwordHash: defaultPasswordHash,
        role: Role.LEARNER,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    // Org A Learner 3 (Engineering, reports to Bob Manager)
    const learnerA3 = await tx.user.create({
      data: {
        organisationId: orgA.id,
        departmentId: deptA1.id,
        managerId: managerA.id,
        name: 'Evan Learner 3',
        email: `evan-${uid}@acme.com`,
        employeeNumber: `EMP-A005-${uid}`,
        passwordHash: defaultPasswordHash,
        role: Role.LEARNER,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    // Org A Inactive Employee
    const inactiveA = await tx.user.create({
      data: {
        organisationId: orgA.id,
        departmentId: deptA1.id,
        name: 'Fiona Inactive',
        email: `fiona-${uid}@acme.com`,
        employeeNumber: `EMP-A006-${uid}`,
        passwordHash: defaultPasswordHash,
        role: Role.LEARNER,
        employmentStatus: EmploymentStatus.INACTIVE,
      },
    });

    // Org B
    const orgB = await tx.organisation.create({
      data: { name: `Beta Ltd ${uid} (Org B)` },
    });

    const deptB = await tx.department.create({
      data: { organisationId: orgB.id, name: 'Operations' },
    });

    const adminB = await tx.user.create({
      data: {
        organisationId: orgB.id,
        departmentId: deptB.id,
        name: 'Boris Admin B',
        email: `admin-${uid}@beta.com`,
        employeeNumber: `EMP-B001-${uid}`,
        passwordHash: defaultPasswordHash,
        role: Role.ORG_ADMIN,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    const learnerB = await tx.user.create({
      data: {
        organisationId: orgB.id,
        departmentId: deptB.id,
        name: 'Brian Learner B',
        email: `brian-${uid}@beta.com`,
        employeeNumber: `EMP-B002-${uid}`,
        passwordHash: defaultPasswordHash,
        role: Role.LEARNER,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    const tokenAdminA = signAccessToken({
      sub: adminA.id,
      organisationId: orgA.id,
      email: adminA.email,
      role: adminA.role,
      name: adminA.name,
      departmentId: adminA.departmentId,
      managerId: adminA.managerId,
    });

    const tokenManagerA = signAccessToken({
      sub: managerA.id,
      organisationId: orgA.id,
      email: managerA.email,
      role: managerA.role,
      name: managerA.name,
      departmentId: managerA.departmentId,
      managerId: managerA.managerId,
    });

    const tokenLearnerA1 = signAccessToken({
      sub: learnerA1.id,
      organisationId: orgA.id,
      email: learnerA1.email,
      role: learnerA1.role,
      name: learnerA1.name,
      departmentId: learnerA1.departmentId,
      managerId: learnerA1.managerId,
    });

    const tokenLearnerA2 = signAccessToken({
      sub: learnerA2.id,
      organisationId: orgA.id,
      email: learnerA2.email,
      role: learnerA2.role,
      name: learnerA2.name,
      departmentId: learnerA2.departmentId,
      managerId: learnerA2.managerId,
    });

    const tokenLearnerA3 = signAccessToken({
      sub: learnerA3.id,
      organisationId: orgA.id,
      email: learnerA3.email,
      role: learnerA3.role,
      name: learnerA3.name,
      departmentId: learnerA3.departmentId,
      managerId: learnerA3.managerId,
    });

    const tokenAdminB = signAccessToken({
      sub: adminB.id,
      organisationId: orgB.id,
      email: adminB.email,
      role: adminB.role,
      name: adminB.name,
      departmentId: adminB.departmentId,
      managerId: adminB.managerId,
    });

    const tokenLearnerB = signAccessToken({
      sub: learnerB.id,
      organisationId: orgB.id,
      email: learnerB.email,
      role: learnerB.role,
      name: learnerB.name,
      departmentId: learnerB.departmentId,
      managerId: learnerB.managerId,
    });

    return {
      app,
      orgA: {
        id: orgA.id,
        name: orgA.name,
        department1: { id: deptA1.id, name: deptA1.name },
        department2: { id: deptA2.id, name: deptA2.name },
        admin: { id: adminA.id, email: adminA.email, token: tokenAdminA },
        manager: { id: managerA.id, email: managerA.email, token: tokenManagerA },
        learner1: { id: learnerA1.id, email: learnerA1.email, token: tokenLearnerA1 },
        learner2: { id: learnerA2.id, email: learnerA2.email, token: tokenLearnerA2 },
        learner3: { id: learnerA3.id, email: learnerA3.email, token: tokenLearnerA3 },
        inactiveUser: { id: inactiveA.id, email: inactiveA.email },
      },
      orgB: {
        id: orgB.id,
        name: orgB.name,
        department: { id: deptB.id, name: deptB.name },
        admin: { id: adminB.id, email: adminB.email, token: tokenAdminB },
        learner: { id: learnerB.id, email: learnerB.email, token: tokenLearnerB },
      },
    };
  });

  return context;
}
