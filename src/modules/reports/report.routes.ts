import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthUser, can } from '../../auth/policy.js';
import {
  exportAssignmentsReport,
  getAssignmentsReport,
} from './report.service.js';
import { AssignmentStatus } from '@prisma/client';

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  // Common preHandler hook: user must have viewOrgReports OR viewTeamReports
  fastify.addHook('preHandler', async (request, reply) => {
    const user = request.user as AuthUser | undefined;
    if (!user) {
      return reply.status(401).send({ error: 'UNAUTHORIZED' });
    }

    const hasOrg = can(user, 'viewOrgReports');
    const hasTeam = can(user, 'viewTeamReports');

    if (!hasOrg && !hasTeam) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'User lacks permission to view reports',
      });
    }
  });

  const reportFilterSchema = z.object({
    campaignId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    status: z.nativeEnum(AssignmentStatus).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isOverdue: z
      .union([z.boolean(), z.string()])
      .transform((val) => (typeof val === 'string' ? val === 'true' : val))
      .optional(),
  });

  // GET /reports/assignments
  fastify.get('/assignments', async (request, reply) => {
    const user = request.user as AuthUser;
    const query = reportFilterSchema.parse(request.query);
    const result = await getAssignmentsReport(user, query);
    return reply.send(result);
  });

  const exportSchema = z.object({
    format: z.enum(['xlsx', 'csv', 'pdf']).default('xlsx'),
    filters: reportFilterSchema.optional().default({}),
  });

  // POST /reports/assignments/export
  fastify.post('/assignments/export', async (request, reply) => {
    const user = request.user as AuthUser;
    const parseResult = exportSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid export parameters',
        details: parseResult.error.format(),
      });
    }

    const { format, filters } = parseResult.data;
    const exportResult = await exportAssignmentsReport(user, filters, format);

    reply.header('Content-Type', exportResult.mimeType);
    reply.header(
      'Content-Disposition',
      `attachment; filename="${exportResult.filename}"`
    );
    return reply.send(exportResult.buffer);
  });
};
