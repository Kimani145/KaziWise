import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../db/client.js';

export type AuditAction =
  | 'employee.create'
  | 'employee.deactivate'
  | 'course.publish'
  | 'campaign.launch'
  | 'assignment.create'
  | 'attempt.submit'
  | 'certificate.issue'
  | 'reminder.send'
  | 'report.export';

export interface AuditLogParams {
  userId: string;
  action: AuditAction | string;
  resourceId?: string | null;
  metadata?: Record<string, any> | null;
}

export async function createAuditLog(
  db: Prisma.TransactionClient | PrismaClient,
  params: AuditLogParams
) {
  return db.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resourceId: params.resourceId || null,
      metadata: params.metadata || Prisma.JsonNull,
    },
  });
}

export async function getAuditLogsForOrg(
  organisationId: string,
  options: {
    limit?: number;
    offset?: number;
    action?: string;
  } = {},
  client: PrismaClient = prisma
) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const whereClause: Prisma.AuditLogWhereInput = {
    user: {
      organisationId,
    },
    ...(options.action ? { action: options.action } : {}),
  };

  const [total, logs] = await Promise.all([
    client.auditLog.count({ where: whereClause }),
    client.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);

  return { total, logs, limit, offset };
}
