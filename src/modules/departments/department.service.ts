import { prisma } from '../../db/client.js';
import { scopedToOrg, withTenantContext } from '../../db/tenant.js';

export async function listDepartments(organisationId: string) {
  return withTenantContext(organisationId, async (tx) => {
    return tx.department.findMany({
      where: scopedToOrg(organisationId),
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  });
}

export async function createDepartment(
  organisationId: string,
  name: string
) {
  return withTenantContext(organisationId, async (tx) => {
    const existing = await tx.department.findFirst({
      where: scopedToOrg(organisationId, {
        name: { equals: name.trim(), mode: 'insensitive' as const },
      }),
    });

    if (existing) {
      const error = new Error(`Department '${name}' already exists in this organisation`);
      (error as any).statusCode = 409;
      (error as any).code = 'DUPLICATE_DEPARTMENT';
      throw error;
    }

    return tx.department.create({
      data: {
        organisationId,
        name: name.trim(),
      },
    });
  });
}

export async function updateDepartment(
  organisationId: string,
  id: string,
  name: string
) {
  return withTenantContext(organisationId, async (tx) => {
    const department = await tx.department.findFirst({
      where: scopedToOrg(organisationId, { id }),
    });

    if (!department) {
      const error = new Error('Department not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    return tx.department.update({
      where: { id },
      data: {
        name: name.trim(),
      },
    });
  });
}
