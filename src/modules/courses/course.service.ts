import { CourseStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/client.js';
import { scopedToOrg, withTenantContext } from '../../db/tenant.js';
import { createAuditLog } from '../audit/audit.service.js';

export interface CreateCourseInput {
  title: string;
  description: string;
  estimatedDuration?: string | null;
  certificateEnabled?: boolean;
}

export interface ContentBlockInput {
  id?: string;
  type: 'TEXT' | 'VIDEO' | 'IMAGE' | 'PDF';
  title: string;
  body: string;
  order: number;
}

export interface LessonInput {
  id?: string;
  title: string;
  order: number;
  required?: boolean;
  blocks?: ContentBlockInput[];
}

export interface ModuleInput {
  id?: string;
  title: string;
  order: number;
  lessons?: LessonInput[];
}

export interface OptionInput {
  id?: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionInput {
  id?: string;
  text: string;
  order: number;
  options: OptionInput[];
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  estimatedDuration?: string | null;
  certificateEnabled?: boolean;
  modules?: ModuleInput[];
  questions?: QuestionInput[];
}

export async function createCourse(
  organisationId: string,
  input: CreateCourseInput
) {
  return withTenantContext(organisationId, async (tx) => {
    return tx.course.create({
      data: {
        organisationId,
        title: input.title.trim(),
        description: input.description.trim(),
        estimatedDuration: input.estimatedDuration || null,
        certificateEnabled: input.certificateEnabled ?? false,
        status: CourseStatus.DRAFT,
        courseVersion: 1,
      },
    });
  });
}

export async function listCourses(organisationId: string) {
  return withTenantContext(organisationId, async (tx) => {
    return tx.course.findMany({
      where: scopedToOrg(organisationId),
      include: {
        _count: {
          select: {
            modules: true,
            questions: true,
            campaigns: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
}

export async function getCourseWithFullGraph(
  organisationId: string,
  courseId: string
) {
  return withTenantContext(organisationId, async (tx) => {
    const course = await tx.course.findFirst({
      where: scopedToOrg(organisationId, { id: courseId }),
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              include: {
                blocks: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: true,
          },
        },
      },
    });

    if (!course) {
      const error = new Error('Course not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    return course;
  });
}

export async function updateCourseGraph(
  organisationId: string,
  courseId: string,
  input: UpdateCourseInput
) {
  return withTenantContext(organisationId, async (tx) => {
    const existing = await tx.course.findFirst({
      where: scopedToOrg(organisationId, { id: courseId }),
    });

    if (!existing) {
      const error = new Error('Course not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    // Update basic course info
    await tx.course.update({
      where: { id: courseId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() } : {}),
        ...(input.estimatedDuration !== undefined ? { estimatedDuration: input.estimatedDuration } : {}),
        ...(input.certificateEnabled !== undefined ? { certificateEnabled: input.certificateEnabled } : {}),
      },
    });

    // If modules structure is supplied, replace or update modules
    if (input.modules) {
      // In MVP edit-in-place, synchronize module graph
      // Delete existing modules (cascades to lessons and blocks)
      await tx.module.deleteMany({ where: { courseId } });

      for (const m of input.modules) {
        const createdModule = await tx.module.create({
          data: {
            courseId,
            title: m.title,
            order: m.order,
          },
        });

        if (m.lessons) {
          for (const l of m.lessons) {
            const createdLesson = await tx.lesson.create({
              data: {
                moduleId: createdModule.id,
                title: l.title,
                order: l.order,
                required: l.required ?? true,
              },
            });

            if (l.blocks) {
              for (const b of l.blocks) {
                await tx.contentBlock.create({
                  data: {
                    lessonId: createdLesson.id,
                    type: b.type,
                    title: b.title,
                    body: b.body,
                    order: b.order,
                  },
                });
              }
            }
          }
        }
      }
    }

    // If questions structure is supplied, synchronize question graph
    if (input.questions) {
      await tx.question.deleteMany({ where: { courseId } });

      for (const q of input.questions) {
        const createdQuestion = await tx.question.create({
          data: {
            courseId,
            text: q.text,
            order: q.order,
          },
        });

        if (q.options) {
          for (const opt of q.options) {
            await tx.option.create({
              data: {
                questionId: createdQuestion.id,
                text: opt.text,
                isCorrect: opt.isCorrect,
              },
            });
          }
        }
      }
    }

    return getCourseWithFullGraph(organisationId, courseId);
  });
}

export async function publishCourse(
  actingUserId: string,
  organisationId: string,
  courseId: string
) {
  return withTenantContext(organisationId, async (tx) => {
    const course = await tx.course.findFirst({
      where: scopedToOrg(organisationId, { id: courseId }),
      include: {
        modules: {
          include: { lessons: true },
        },
        questions: {
          include: { options: true },
        },
      },
    });

    if (!course) {
      const error = new Error('Course not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    // Section 1: "if this is a re-publish of an already-published course, increment courseVersion"
    const nextVersion =
      course.status === CourseStatus.PUBLISHED
        ? course.courseVersion + 1
        : course.courseVersion;

    const updated = await tx.course.update({
      where: { id: courseId },
      data: {
        status: CourseStatus.PUBLISHED,
        courseVersion: nextVersion,
      },
    });

    await createAuditLog(tx, {
      userId: actingUserId,
      action: 'course.publish',
      resourceId: courseId,
      metadata: {
        courseVersion: nextVersion,
        title: updated.title,
      },
    });

    return updated;
  });
}

export async function previewCourse(
  organisationId: string,
  courseId: string
) {
  return withTenantContext(organisationId, async (tx) => {
    // QA fix: Strictly scope to this course's own modules/lessons/blocks/questions
    const course = await tx.course.findFirst({
      where: scopedToOrg(organisationId, { id: courseId }),
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              include: {
                blocks: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: {
              select: {
                id: true,
                text: true,
                // Do NOT leak isCorrect in learner preview!
              },
            },
          },
        },
      },
    });

    if (!course) {
      const error = new Error('Course not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    return course;
  });
}
