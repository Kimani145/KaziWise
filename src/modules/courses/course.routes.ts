import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthUser, requirePermission } from '../../auth/policy.js';
import {
  createCourse,
  getCourseWithFullGraph,
  listCourses,
  previewCourse,
  publishCourse,
  updateCourseGraph,
} from './course.service.js';

export const courseRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /courses: list all courses in the organisation
  fastify.get('/', async (request, reply) => {
    const user = request.user as AuthUser;
    const courses = await listCourses(user.organisationId);
    return reply.send(courses);
  });

  const createCourseSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    estimatedDuration: z.string().nullable().optional(),
    certificateEnabled: z.boolean().optional(),
  });

  // POST /courses: create draft course
  fastify.post(
    '/',
    { preHandler: [requirePermission('authorCourses')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const parseResult = createCourseSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid course payload',
          details: parseResult.error.format(),
        });
      }

      try {
        const course = await createCourse(user.organisationId, parseResult.data);
        return reply.status(201).send(course);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );

  // GET /courses/:id: full graph
  fastify.get(
    '/:id',
    { preHandler: [requirePermission('authorCourses')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { id } = request.params as { id: string };

      try {
        const course = await getCourseWithFullGraph(user.organisationId, id);
        return reply.send(course);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );

  const updateCourseSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    estimatedDuration: z.string().nullable().optional(),
    certificateEnabled: z.boolean().optional(),
    modules: z
      .array(
        z.object({
          id: z.string().optional(),
          title: z.string().min(1),
          order: z.number().int(),
          lessons: z
            .array(
              z.object({
                id: z.string().optional(),
                title: z.string().min(1),
                order: z.number().int(),
                required: z.boolean().optional(),
                blocks: z
                  .array(
                    z.object({
                      id: z.string().optional(),
                      type: z.enum(['TEXT', 'VIDEO', 'IMAGE', 'PDF']),
                      title: z.string().min(1),
                      body: z.string(),
                      order: z.number().int(),
                    })
                  )
                  .optional(),
              })
            )
            .optional(),
        })
      )
      .optional(),
    questions: z
      .array(
        z.object({
          id: z.string().optional(),
          text: z.string().min(1),
          order: z.number().int(),
          options: z.array(
            z.object({
              id: z.string().optional(),
              text: z.string().min(1),
              isCorrect: z.boolean(),
            })
          ),
        })
      )
      .optional(),
  });

  // PATCH /courses/:id: update course and graph
  fastify.patch(
    '/:id',
    { preHandler: [requirePermission('authorCourses')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { id } = request.params as { id: string };
      const parseResult = updateCourseSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid update payload',
          details: parseResult.error.format(),
        });
      }

      try {
        const updated = await updateCourseGraph(
          user.organisationId,
          id,
          parseResult.data
        );
        return reply.send(updated);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );

  // POST /courses/:id/publish: publish and version increment
  fastify.post(
    '/:id/publish',
    { preHandler: [requirePermission('publishCourses')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { id } = request.params as { id: string };

      try {
        const published = await publishCourse(user.id, user.organisationId, id);
        return reply.send(published);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );

  // POST /courses/:id/preview: course preview
  fastify.post(
    '/:id/preview',
    { preHandler: [requirePermission('authorCourses')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { id } = request.params as { id: string };

      try {
        const preview = await previewCourse(user.organisationId, id);
        return reply.send(preview);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );
};
