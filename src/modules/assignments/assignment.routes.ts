import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthUser } from '../../auth/policy.js';
import {
  completeLesson,
  getAssignmentAssessment,
  getLearnerAssignmentDetail,
  getLearnerAssignments,
  getLearnerCertificates,
  submitAssessmentAttempt,
} from './assignment.service.js';

export const assignmentRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /me/assignments
  fastify.get('/assignments', async (request, reply) => {
    const user = request.user as AuthUser;
    const assignments = await getLearnerAssignments(user.organisationId, user.id);
    return reply.send(assignments);
  });

  // GET /me/assignments/:assignmentId
  fastify.get('/assignments/:assignmentId', async (request, reply) => {
    const user = request.user as AuthUser;
    const { assignmentId } = request.params as { assignmentId: string };

    try {
      const detail = await getLearnerAssignmentDetail(
        user.organisationId,
        user.id,
        assignmentId
      );
      return reply.send(detail);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: err.code || 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  });

  // POST /me/assignments/:assignmentId/lessons/:lessonId/complete
  fastify.post(
    '/assignments/:assignmentId/lessons/:lessonId/complete',
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { assignmentId, lessonId } = request.params as {
        assignmentId: string;
        lessonId: string;
      };

      try {
        const result = await completeLesson(
          user.organisationId,
          user.id,
          assignmentId,
          lessonId
        );
        return reply.send(result);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );

  // GET /me/assignments/:assignmentId/assessment
  fastify.get('/assignments/:assignmentId/assessment', async (request, reply) => {
    const user = request.user as AuthUser;
    const { assignmentId } = request.params as { assignmentId: string };

    try {
      const assessment = await getAssignmentAssessment(
        user.organisationId,
        user.id,
        assignmentId
      );
      return reply.send(assessment);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: err.code || 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  });

  const attemptSchema = z.object({
    answers: z.record(z.string(), z.string()),
  });

  // POST /me/assignments/:assignmentId/attempts
  fastify.post('/assignments/:assignmentId/attempts', async (request, reply) => {
    const user = request.user as AuthUser;
    const { assignmentId } = request.params as { assignmentId: string };
    const parseResult = attemptSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid answers payload format',
      });
    }

    try {
      const result = await submitAssessmentAttempt(
        user.organisationId,
        user.id,
        assignmentId,
        parseResult.data.answers
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: err.code || 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  });

  // GET /me/certificates
  fastify.get('/certificates', async (request, reply) => {
    const user = request.user as AuthUser;
    const certificates = await getLearnerCertificates(user.organisationId, user.id);
    return reply.send(certificates);
  });
};
