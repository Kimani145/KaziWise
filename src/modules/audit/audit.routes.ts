import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthUser, requirePermission } from '../../auth/policy.js';
import { getAuditLogsForOrg } from './audit.service.js';

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requirePermission('viewOrgReports'));

  const querySchema = z.object({
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
    action: z.string().optional(),
  });

  fastify.get('/', async (request, reply) => {
    const user = request.user as AuthUser;
    const query = querySchema.parse(request.query);
    const result = await getAuditLogsForOrg(user.organisationId, query);
    return reply.send(result);
  });
};
