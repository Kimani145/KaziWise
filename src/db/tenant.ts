import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './client.js';

/**
 * Executes a callback within a database transaction where Postgres RLS is bound
 * to the given tenant organisationId via `SET LOCAL app.current_org_id = ...`.
 * 
 * Defense-in-depth:
 * 1. Postgres RLS blocks any cross-tenant row access at the database engine level.
 * 2. Repository helpers inject organisationId at the application level.
 */
export async function withTenantContext<T>(
  organisationId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  client: PrismaClient = prisma
): Promise<T> {
  if (!organisationId) {
    throw new Error('Tenant context requires a valid organisationId');
  }

  return client.$transaction(async (tx) => {
    // Sanitize and set Postgres session variable for RLS
    const sanitizedOrgId = organisationId.replace(/'/g, "''");
    await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${sanitizedOrgId}';`);
    await tx.$executeRawUnsafe(`SET LOCAL app.bypass_rls = 'off';`);
    return callback(tx);
  });
}

/**
 * Executes a callback with RLS bypassed.
 * Explicitly used for system operations, seeding, or public verification endpoints.
 */
export async function withBypassRls<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  client: PrismaClient = prisma
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.bypass_rls = 'on';`);
    return callback(tx);
  });
}

/**
 * Shared helper that injects organisationId into query filter objects.
 * Prevents forgetting the WHERE organisationId clause.
 */
export function scopedToOrg<T extends Record<string, any>>(
  organisationId: string,
  whereClause?: T
): T & { organisationId: string } {
  return {
    ...(whereClause || ({} as T)),
    organisationId,
  };
}
