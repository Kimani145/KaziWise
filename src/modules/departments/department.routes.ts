import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthUser, requirePermission } from '../../auth/policy.js';
import {
  createDepartment,
  listDepartments,
  updateDepartment,
} from './department.service.js';

export const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const user = request.user as AuthUser;
    const departments = await listDepartments(user.organisationId);
    return reply.send(departments);
  });

  const departmentSchema = z.object({
    name: z.string().min(1),
  });

  fastify.post(
    '/',
    { preHandler: [requirePermission('manageDepartments')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const parseResult = departmentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid department name',
        });
      }

      try {
        const created = await createDepartment(
          user.organisationId,
          parseResult.data.name
        );
        return reply.status(201).send(created);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );

  fastify.patch(
    '/:id',
    { preHandler: [requirePermission('manageDepartments')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { id } = request.params as { id: string };
      const parseResult = departmentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid department name',
        });
      }

      try {
        const updated = await updateDepartment(
          user.organisationId,
          id,
          parseResult.data.name
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
};
