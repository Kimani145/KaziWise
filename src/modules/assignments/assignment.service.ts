import {
  AssignmentStatus,
  AttemptResult,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../db/client.js';
import { scopedToOrg, withTenantContext } from '../../db/tenant.js';
import { calculateScore, QuestionItem } from '../assessment/scoring.js';
import { createAuditLog } from '../audit/audit.service.js';
import crypto from 'crypto';

export interface CompleteLessonResult {
  assignmentId: string;
  lessonId: string;
  previousStatus: AssignmentStatus;
  currentStatus: AssignmentStatus;
  requiredCompleted: number;
  totalRequired: number;
}

export async function getLearnerAssignments(
  organisationId: string,
  userId: string
) {
  return withTenantContext(organisationId, async (tx) => {
    const assignments = await tx.assignment.findMany({
      where: { userId },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            passMark: true,
            certificateEnabled: true,
            course: {
              select: {
                id: true,
                title: true,
                description: true,
                estimatedDuration: true,
              },
            },
          },
        },
        certificate: {
          select: {
            id: true,
            certificateNumber: true,
            verificationCode: true,
            completionDate: true,
            completedLate: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const now = new Date();
    return assignments.map((a) => ({
      ...a,
      isOverdue: a.deadline < now && a.status !== AssignmentStatus.PASSED,
    }));
  });
}

export async function getLearnerAssignmentDetail(
  organisationId: string,
  userId: string,
  assignmentId: string
) {
  return withTenantContext(organisationId, async (tx) => {
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: {
          include: {
            course: {
              include: {
                modules: {
                  orderBy: { order: 'asc' },
                  include: {
                    lessons: {
                      orderBy: { order: 'asc' },
                      include: {
                        blocks: { orderBy: { order: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        lessonProgress: true,
        attempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
        certificate: true,
      },
    });

    if (!assignment) {
      const error = new Error('Assignment not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    // IDOR check: Verify assignment belongs to requesting user
    if (assignment.userId !== userId) {
      const error = new Error('Access denied: assignment does not belong to user');
      (error as any).statusCode = 403;
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const now = new Date();
    const completedLessonIds = new Set(assignment.lessonProgress.map((lp) => lp.lessonId));

    return {
      id: assignment.id,
      campaignId: assignment.campaignId,
      campaignName: assignment.campaign.name,
      courseId: assignment.campaign.courseId,
      courseTitle: assignment.campaign.course.title,
      courseDescription: assignment.campaign.course.description,
      courseVersion: assignment.courseVersion,
      passMark: assignment.campaign.passMark,
      certificateEnabled: assignment.campaign.certificateEnabled,
      status: assignment.status,
      deadline: assignment.deadline,
      score: assignment.score,
      isOverdue: assignment.deadline < now && assignment.status !== AssignmentStatus.PASSED,
      completedLessonIds: Array.from(completedLessonIds),
      modules: assignment.campaign.course.modules,
      latestAttempt: assignment.attempts[0] || null,
      certificate: assignment.certificate,
    };
  });
}

export async function completeLesson(
  organisationId: string,
  userId: string,
  assignmentId: string,
  lessonId: string
): Promise<CompleteLessonResult> {
  return withTenantContext(organisationId, async (tx) => {
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: {
          include: {
            course: {
              include: {
                modules: {
                  include: {
                    lessons: true,
                  },
                },
              },
            },
          },
        },
        lessonProgress: true,
      },
    });

    if (!assignment) {
      const error = new Error('Assignment not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    // IDOR check: verify assignment belongs to req.user.id
    if (assignment.userId !== userId) {
      const error = new Error('Forbidden: Cannot complete lessons for another user');
      (error as any).statusCode = 403;
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    // Terminal state guard: PASSED assignments cannot be mutated (Section 1 & 4)
    if (assignment.status === AssignmentStatus.PASSED) {
      const error = new Error('Assignment is already passed and cannot be modified');
      (error as any).statusCode = 409;
      (error as any).code = 'ASSIGNMENT_ALREADY_PASSED';
      throw error;
    }

    // Verify lesson belongs to this course
    const allCourseLessons = assignment.campaign.course.modules.flatMap((m) => m.lessons);
    const targetLesson = allCourseLessons.find((l) => l.id === lessonId);
    if (!targetLesson) {
      const error = new Error('Lesson does not belong to this assignment course');
      (error as any).statusCode = 400;
      (error as any).code = 'INVALID_LESSON';
      throw error;
    }

    // Upsert lesson progress
    await tx.lessonProgress.upsert({
      where: {
        assignmentId_lessonId: {
          assignmentId,
          lessonId,
        },
      },
      create: {
        assignmentId,
        lessonId,
      },
      update: {
        completedAt: new Date(),
      },
    });

    // Re-fetch completed lesson IDs
    const updatedProgress = await tx.lessonProgress.findMany({
      where: { assignmentId },
    });
    const completedIds = new Set(updatedProgress.map((p) => p.lessonId));

    const requiredLessons = allCourseLessons.filter((l) => l.required);
    const totalRequired = requiredLessons.length;
    const requiredCompleted = requiredLessons.filter((l) => completedIds.has(l.id)).length;

    // State machine calculation per Section 4:
    // ASSIGNED -> STARTED (at least 1 lesson complete / first opened)
    // STARTED -> IN_PROGRESS (at least 1 required lesson complete, not all)
    // IN_PROGRESS -> COMPLETED (all required lessons complete -> unlocked for assessment)
    // If already FAILED, keep FAILED (retake allows going straight to assessment)
    let nextStatus: AssignmentStatus = assignment.status;

    if (assignment.status !== AssignmentStatus.FAILED) {
      if (totalRequired === 0 || requiredCompleted >= totalRequired) {
        nextStatus = AssignmentStatus.COMPLETED;
      } else if (requiredCompleted > 0) {
        nextStatus = AssignmentStatus.IN_PROGRESS;
      } else {
        nextStatus = AssignmentStatus.STARTED;
      }
    }

    if (nextStatus !== assignment.status) {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: { status: nextStatus },
      });
    }

    return {
      assignmentId,
      lessonId,
      previousStatus: assignment.status,
      currentStatus: nextStatus,
      requiredCompleted,
      totalRequired,
    };
  });
}

export async function getAssignmentAssessment(
  organisationId: string,
  userId: string,
  assignmentId: string
) {
  return withTenantContext(organisationId, async (tx) => {
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: {
          include: {
            course: {
              include: {
                modules: {
                  include: { lessons: true },
                },
                questions: {
                  orderBy: { order: 'asc' },
                  include: {
                    options: {
                      select: {
                        id: true,
                        text: true,
                        // NEVER leak isCorrect to learner
                      },
                    },
                  },
                },
              },
            },
          },
        },
        lessonProgress: true,
      },
    });

    if (!assignment) {
      const error = new Error('Assignment not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    if (assignment.userId !== userId) {
      const error = new Error('Forbidden: Cannot access assessment for another user');
      (error as any).statusCode = 403;
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    // Verify required lessons are complete
    const requiredLessons = assignment.campaign.course.modules
      .flatMap((m) => m.lessons)
      .filter((l) => l.required);
    const completedIds = new Set(assignment.lessonProgress.map((p) => p.lessonId));
    const allRequiredComplete = requiredLessons.every((l) => completedIds.has(l.id));

    if (
      !allRequiredComplete &&
      assignment.status !== AssignmentStatus.COMPLETED &&
      assignment.status !== AssignmentStatus.FAILED &&
      assignment.status !== AssignmentStatus.PASSED
    ) {
      const error = new Error('Cannot take assessment: Required lessons are not completed');
      (error as any).statusCode = 409;
      (error as any).code = 'LESSONS_INCOMPLETE';
      throw error;
    }

    // QA fix: Returns questions for THIS assignment's course ONLY
    return {
      assignmentId: assignment.id,
      courseId: assignment.campaign.courseId,
      courseTitle: assignment.campaign.course.title,
      passMark: assignment.campaign.passMark,
      questions: assignment.campaign.course.questions,
    };
  });
}

export async function submitAssessmentAttempt(
  organisationId: string,
  userId: string,
  assignmentId: string,
  answers: Record<string, string>
) {
  return withTenantContext(organisationId, async (tx) => {
    // 1. Fetch assignment with full course question graph and campaign config
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: {
          include: {
            course: {
              include: {
                modules: {
                  include: { lessons: true },
                },
                questions: {
                  include: {
                    options: true,
                  },
                },
              },
            },
          },
        },
        attempts: {
          orderBy: { attemptNumber: 'desc' },
        },
        lessonProgress: true,
        user: true,
      },
    });

    if (!assignment) {
      const error = new Error('Assignment not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    // 2. IDOR Guard: Verify assignment belongs to req.user.id
    if (assignment.userId !== userId) {
      const error = new Error('Forbidden: Cannot submit assessment for another user');
      (error as any).statusCode = 403;
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    // 3. Post-pass mutation guard: Reject if already PASSED (Section 1 & 4)
    if (assignment.status === AssignmentStatus.PASSED) {
      const error = new Error('Assignment is already passed and cannot be re-submitted');
      (error as any).statusCode = 409;
      (error as any).code = 'ASSIGNMENT_ALREADY_PASSED';
      throw error;
    }

    // 4. Verify lessons are complete (must be in COMPLETED or FAILED state)
    const requiredLessons = assignment.campaign.course.modules
      .flatMap((m) => m.lessons)
      .filter((l) => l.required);
    const completedIds = new Set(assignment.lessonProgress.map((p) => p.lessonId));
    const allRequiredComplete = requiredLessons.every((l) => completedIds.has(l.id));

    if (!allRequiredComplete && assignment.status !== AssignmentStatus.COMPLETED && assignment.status !== AssignmentStatus.FAILED) {
      const error = new Error('Cannot submit assessment: Required lessons are not completed');
      (error as any).statusCode = 409;
      (error as any).code = 'LESSONS_INCOMPLETE';
      throw error;
    }

    // 5. Pure scoring calculation
    const courseQuestions: QuestionItem[] = assignment.campaign.course.questions.map((q) => ({
      id: q.id,
      options: q.options.map((opt) => ({
        id: opt.id,
        isCorrect: opt.isCorrect,
      })),
    }));

    const scoring = calculateScore(answers, courseQuestions, assignment.campaign.passMark);
    const nextAttemptNumber = (assignment.attempts[0]?.attemptNumber || 0) + 1;

    // 6. Record Attempt (append-only)
    const attempt = await tx.attempt.create({
      data: {
        assignmentId,
        attemptNumber: nextAttemptNumber,
        answers: answers as any,
        score: scoring.score,
        result: scoring.passed ? AttemptResult.PASSED : AttemptResult.FAILED,
      },
    });

    // Write audit log for attempt submit
    await createAuditLog(tx, {
      userId,
      action: 'attempt.submit',
      resourceId: attempt.id,
      metadata: {
        assignmentId,
        attemptNumber: nextAttemptNumber,
        score: scoring.score,
        passed: scoring.passed,
      },
    });

    const now = new Date();
    const isLate = assignment.deadline < now;
    let certificate = null;

    if (scoring.passed) {
      // 7. Handled PASSED state:
      // Set completedLateAt if deadline < now()
      const completedLateAt = isLate ? now : null;

      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.PASSED,
          score: scoring.score,
          ...(completedLateAt ? { completedLateAt } : {}),
        },
      });

      // 8. Sole runtime certificate authority: Campaign.certificateEnabled (Section 1)
      if (assignment.campaign.certificateEnabled) {
        // Generate unique certificateNumber & verificationCode
        const certificateNumber = `CERT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const verificationCode = crypto.randomBytes(6).toString('hex').toUpperCase();

        certificate = await tx.certificate.create({
          data: {
            assignmentId,
            userId,
            courseId: assignment.campaign.courseId,
            courseVersion: assignment.courseVersion,
            score: scoring.score,
            certificateNumber,
            verificationCode,
            completionDate: now,
            completedLate: isLate,
          },
        });

        // Write audit log for certificate issue
        await createAuditLog(tx, {
          userId,
          action: 'certificate.issue',
          resourceId: certificate.id,
          metadata: {
            certificateNumber,
            verificationCode,
            courseId: assignment.campaign.courseId,
            score: scoring.score,
            completedLate: isLate,
          },
        });
      }
    } else {
      // Failed: transition to FAILED (retake allowed per state machine)
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.FAILED,
          score: scoring.score,
        },
      });
    }

    return {
      attemptNumber: nextAttemptNumber,
      score: scoring.score,
      passed: scoring.passed,
      passMark: assignment.campaign.passMark,
      status: scoring.passed ? AssignmentStatus.PASSED : AssignmentStatus.FAILED,
      certificate,
    };
  });
}

export async function getLearnerCertificates(
  organisationId: string,
  userId: string
) {
  return withTenantContext(organisationId, async (tx) => {
    return tx.certificate.findMany({
      where: { userId },
      include: {
        assignment: {
          include: {
            campaign: {
              select: {
                name: true,
                course: {
                  select: {
                    title: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { completionDate: 'desc' },
    });
  });
}
