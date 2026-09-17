import { FastifyPluginAsync } from 'fastify';
import { AuthUser, requirePermission } from '../../auth/policy.js';
import { prisma } from '../../db/client.js';
import { scopedToOrg, withTenantContext } from '../../db/tenant.js';
import { createAuditLog } from '../audit/audit.service.js';

export const reminderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requirePermission('sendReminders'));

  // POST /assignments/:id/remind
  fastify.post('/:id/remind', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };

    const result = await withTenantContext(user.organisationId, async (tx) => {
      const assignment = await tx.assignment.findUnique({
        where: { id },
        include: {
          user: true,
          campaign: true,
        },
      });

      if (!assignment) {
        const error = new Error('Assignment not found');
        (error as any).statusCode = 404;
        (error as any).code = 'NOT_FOUND';
        throw error;
      }

      // If user is a MANAGER, verify that assignment belongs to a direct report
      if (user.role === 'MANAGER' && assignment.user.managerId !== user.id) {
        const error = new Error('Forbidden: Managers can only send reminders to their direct reports');
        (error as any).statusCode = 403;
        (error as any).code = 'FORBIDDEN';
        throw error;
      }

      const now = new Date();
      const updated = await tx.assignment.update({
        where: { id },
        data: {
          lastReminderAt: now,
        },
      });

      // Real database write: AuditLog per Section 6 & 8
      await createAuditLog(tx, {
        userId: user.id,
        action: 'reminder.send',
        resourceId: assignment.id,
        metadata: {
          learnerId: assignment.userId,
          learnerEmail: assignment.user.email,
          campaignName: assignment.campaign.name,
          reminderTimestamp: now.toISOString(),
        },
      });

      return {
        success: true,
        message: `Reminder sent to ${assignment.user.email}`,
        assignmentId: updated.id,
        lastReminderAt: updated.lastReminderAt,
      };
    });

    return reply.send(result);
  });
};
