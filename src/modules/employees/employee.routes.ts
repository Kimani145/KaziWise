import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthUser, requirePermission } from '../../auth/policy.js';
import {
  createEmployee,
  importEmployees,
  listEmployees,
  updateEmployee,
} from './employee.service.js';
import { EmploymentStatus, Role } from '@prisma/client';

export const employeeRoutes: FastifyPluginAsync = async (fastify) => {
  // All employee management routes require manageEmployees (ORG_ADMIN)
  fastify.addHook('preHandler', requirePermission('manageEmployees'));

  const listQuerySchema = z.object({
    departmentId: z.string().optional(),
    search: z.string().optional(),
    employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
  });

  fastify.get('/', async (request, reply) => {
    const user = request.user as AuthUser;
    const query = listQuerySchema.parse(request.query);
    const result = await listEmployees(user.organisationId, query);
    return reply.send(result);
  });

  const createSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    employeeNumber: z.string().min(1),
    departmentId: z.string().uuid(),
    role: z.nativeEnum(Role).optional(),
    managerId: z.string().uuid().nullable().optional(),
    password: z.string().min(6).optional(),
    employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
  });

  fastify.post('/', async (request, reply) => {
    const user = request.user as AuthUser;
    const parseResult = createSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid employee payload',
        details: parseResult.error.format(),
      });
    }

    try {
      const created = await createEmployee(
        user.id,
        user.organisationId,
        parseResult.data
      );
      return reply.status(201).send(created);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: err.code || 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  });

  fastify.post('/import', async (request, reply) => {
    const user = request.user as AuthUser;
    let buffer: Buffer;
    let format: 'csv' | 'xlsx' = 'csv';

    // Handle multipart upload or JSON with base64/content
    if (request.isMultipart()) {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'No file uploaded',
        });
      }
      buffer = await data.toBuffer();
      if (
        data.filename.endsWith('.xlsx') ||
        data.mimetype.includes('spreadsheetml')
      ) {
        format = 'xlsx';
      }
    } else {
      const body = (request.body as any) || {};
      if (body.csvContent) {
        buffer = Buffer.from(body.csvContent, 'utf-8');
        format = 'csv';
      } else if (body.base64Data) {
        buffer = Buffer.from(body.base64Data, 'base64');
        format = body.format === 'xlsx' ? 'xlsx' : 'csv';
      } else {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'Either multipart file, csvContent, or base64Data is required',
        });
      }
    }

    const result = await importEmployees(
      user.id,
      user.organisationId,
      buffer,
      format
    );
    return reply.send(result);
  });

  const updateSchema = z.object({
    name: z.string().min(1).optional(),
    departmentId: z.string().uuid().optional(),
    managerId: z.string().uuid().nullable().optional(),
    role: z.nativeEnum(Role).optional(),
    employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
  });

  fastify.patch('/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const parseResult = updateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid update payload',
        details: parseResult.error.format(),
      });
    }

    try {
      const updated = await updateEmployee(
        user.id,
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
  });
};
