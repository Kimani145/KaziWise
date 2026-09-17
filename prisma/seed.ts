import { PrismaClient, Role, EmploymentStatus, CourseStatus, AudienceType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { withBypassRls } from '../src/db/tenant.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding KaziWise LMS initial production dataset...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  await withBypassRls(async (tx) => {
    // 1. Create Default Organisation
    let org = await tx.organisation.findFirst({
      where: { name: 'KaziWise Technologies' },
    });

    if (!org) {
      org = await tx.organisation.create({
        data: {
          name: 'KaziWise Technologies',
        },
      });
      console.log(`Created Organisation: ${org.name} (${org.id})`);
    }

    // 2. Create Departments
    const deptEngineering = await tx.department.upsert({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      update: {},
      create: {
        id: '11111111-1111-1111-1111-111111111111',
        organisationId: org.id,
        name: 'Engineering',
      },
    });

    const deptHR = await tx.department.upsert({
      where: { id: '22222222-2222-2222-2222-222222222222' },
      update: {},
      create: {
        id: '22222222-2222-2222-2222-222222222222',
        organisationId: org.id,
        name: 'Human Resources',
      },
    });

    // 3. Create Super Admin (platform-level)
    await tx.user.upsert({
      where: { email: 'superadmin@kaziwise.com' },
      update: {},
      create: {
        organisationId: org.id,
        departmentId: deptEngineering.id,
        name: 'KaziWise Platform Super Admin',
        email: 'superadmin@kaziwise.com',
        employeeNumber: 'SA-001',
        passwordHash,
        role: Role.SUPER_ADMIN,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    // 4. Create Org Admin
    const orgAdmin = await tx.user.upsert({
      where: { email: 'admin@kaziwise.com' },
      update: {},
      create: {
        organisationId: org.id,
        departmentId: deptHR.id,
        name: 'Elena Vance (Org Admin)',
        email: 'admin@kaziwise.com',
        employeeNumber: 'EMP-001',
        passwordHash,
        role: Role.ORG_ADMIN,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    // 5. Create Manager
    const manager = await tx.user.upsert({
      where: { email: 'manager@kaziwise.com' },
      update: {},
      create: {
        organisationId: org.id,
        departmentId: deptEngineering.id,
        name: 'Marcus Brody (Manager)',
        email: 'manager@kaziwise.com',
        employeeNumber: 'EMP-002',
        passwordHash,
        role: Role.MANAGER,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    // 6. Create Learners
    const learner1 = await tx.user.upsert({
      where: { email: 'learner@kaziwise.com' },
      update: { managerId: manager.id },
      create: {
        organisationId: org.id,
        departmentId: deptEngineering.id,
        managerId: manager.id,
        name: 'Chloe Decker (Learner)',
        email: 'learner@kaziwise.com',
        employeeNumber: 'EMP-003',
        passwordHash,
        role: Role.LEARNER,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    await tx.user.upsert({
      where: { email: 'lucifer@kaziwise.com' },
      update: { managerId: manager.id },
      create: {
        organisationId: org.id,
        departmentId: deptEngineering.id,
        managerId: manager.id,
        name: 'Dan Espinoza (Learner)',
        email: 'lucifer@kaziwise.com',
        employeeNumber: 'EMP-004',
        passwordHash,
        role: Role.LEARNER,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    console.log('Seeded Users: admin@kaziwise.com, manager@kaziwise.com, learner@kaziwise.com (Password: Password123!)');

    // 7. Create Sample Published Course
    let course = await tx.course.findFirst({
      where: { organisationId: org.id, title: 'Information Security & Data Protection Compliance' },
    });

    if (!course) {
      course = await tx.course.create({
        data: {
          organisationId: org.id,
          title: 'Information Security & Data Protection Compliance',
          description: 'Mandatory annual training on data privacy, security fundamentals, and phishing defence.',
          estimatedDuration: '45 mins',
          status: CourseStatus.PUBLISHED,
          certificateEnabled: true,
          courseVersion: 1,
          modules: {
            create: [
              {
                title: 'Module 1: Password Hygiene and Phishing Prevention',
                order: 1,
                lessons: {
                  create: [
                    {
                      title: 'Recognising Phishing Signals',
                      order: 1,
                      required: true,
                      blocks: {
                        create: [
                          {
                            type: 'TEXT',
                            title: 'Understanding Phishing Attacks',
                            body: 'Phishing is a social engineering attack where bad actors deceive individuals into providing sensitive credentials.',
                            order: 1,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              {
                title: 'Module 2: Sensitive Data Handling',
                order: 2,
                lessons: {
                  create: [
                    {
                      title: 'Confidentiality Principles',
                      order: 1,
                      required: true,
                      blocks: {
                        create: [
                          {
                            type: 'TEXT',
                            title: 'Data Classification Guide',
                            body: 'All internal documents must be classified into Public, Internal, Confidential, and Restricted tiers.',
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
          questions: {
            create: [
              {
                text: 'What is the recommended minimum length for a company account passphrase?',
                order: 1,
                options: {
                  create: [
                    { text: '6 characters', isCorrect: false },
                    { text: '12 characters or passphrase', isCorrect: true },
                    { text: '4 digits', isCorrect: false },
                  ],
                },
              },
              {
                text: 'What should you do immediately if you receive a suspicious link requesting your login password?',
                order: 2,
                options: {
                  create: [
                    { text: 'Click it to check if it is valid', isCorrect: false },
                    { text: 'Forward it to friends', isCorrect: false },
                    { text: 'Report to IT Security and do not click', isCorrect: true },
                  ],
                },
              },
            ],
          },
        },
      });
      console.log(`Created Course: ${course.title} (${course.id})`);
    }

    // 8. Create Sample Campaign
    let campaign = await tx.campaign.findFirst({
      where: { organisationId: org.id, name: 'Q3 Mandatory Compliance 2026' },
    });

    if (!campaign) {
      campaign = await tx.campaign.create({
        data: {
          organisationId: org.id,
          courseId: course.id,
          name: 'Q3 Mandatory Compliance 2026',
          audienceType: AudienceType.ALL_EMPLOYEES,
          status: 'ACTIVE',
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          passMark: 80,
          certificateEnabled: true,
        },
      });

      // Create initial assignments
      await tx.assignment.createMany({
        data: [
          {
            campaignId: campaign.id,
            userId: learner1.id,
            status: 'ASSIGNED',
            courseVersion: course.courseVersion,
            deadline: campaign.deadline,
          },
        ],
        skipDuplicates: true,
      });

      console.log(`Created Campaign: ${campaign.name} (${campaign.id})`);
    }
  });

  console.log('✅ Database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
