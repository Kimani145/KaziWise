import { EmploymentStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../db/client.js';
import { scopedToOrg, withTenantContext } from '../../db/tenant.js';
import { hashPassword } from '../../auth/jwt.js';
import { createAuditLog } from '../audit/audit.service.js';
import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import crypto from 'crypto';

export interface CreateEmployeeInput {
  name: string;
  email: string;
  employeeNumber: string;
  departmentId: string;
  role?: Role;
  managerId?: string | null;
  password?: string;
  employmentStatus?: EmploymentStatus;
}

export interface UpdateEmployeeInput {
  name?: string;
  departmentId?: string;
  managerId?: string | null;
  role?: Role;
  employmentStatus?: EmploymentStatus;
}

export async function createEmployee(
  actingUserId: string,
  organisationId: string,
  input: CreateEmployeeInput
) {
  return withTenantContext(organisationId, async (tx) => {
    // 1. Check duplicate email globally / in DB
    const existingEmail = await tx.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });
    if (existingEmail) {
      const error = new Error(`Email ${input.email} is already in use`);
      (error as any).statusCode = 409;
      (error as any).code = 'DUPLICATE_EMAIL';
      throw error;
    }

    // 2. Check duplicate employeeNumber within organisation
    const existingEmpNo = await tx.user.findFirst({
      where: scopedToOrg(organisationId, {
        employeeNumber: input.employeeNumber.trim(),
      }),
    });
    if (existingEmpNo) {
      const error = new Error(`Employee number ${input.employeeNumber} is already in use in this organisation`);
      (error as any).statusCode = 409;
      (error as any).code = 'DUPLICATE_EMPLOYEE_NUMBER';
      throw error;
    }

    // 3. Verify department belongs to organisation
    const department = await tx.department.findFirst({
      where: scopedToOrg(organisationId, { id: input.departmentId }),
    });
    if (!department) {
      const error = new Error('Department not found in organisation');
      (error as any).statusCode = 400;
      (error as any).code = 'INVALID_DEPARTMENT';
      throw error;
    }

    // 4. Verify manager if supplied
    if (input.managerId) {
      const manager = await tx.user.findFirst({
        where: scopedToOrg(organisationId, { id: input.managerId }),
      });
      if (!manager) {
        const error = new Error('Manager not found in organisation');
        (error as any).statusCode = 400;
        (error as any).code = 'INVALID_MANAGER';
        throw error;
      }
    }

    const initialPassword = input.password || crypto.randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(initialPassword);

    const user = await tx.user.create({
      data: {
        organisationId,
        departmentId: input.departmentId,
        managerId: input.managerId || null,
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        employeeNumber: input.employeeNumber.trim(),
        passwordHash,
        role: input.role || Role.LEARNER,
        employmentStatus: input.employmentStatus || EmploymentStatus.INVITED,
      },
      select: {
        id: true,
        organisationId: true,
        name: true,
        email: true,
        employeeNumber: true,
        role: true,
        employmentStatus: true,
        departmentId: true,
        managerId: true,
        createdAt: true,
      },
    });

    // Write AuditLog
    await createAuditLog(tx, {
      userId: actingUserId,
      action: 'employee.create',
      resourceId: user.id,
      metadata: {
        employeeNumber: user.employeeNumber,
        email: user.email,
        role: user.role,
      },
    });

    return user;
  });
}

export async function listEmployees(
  organisationId: string,
  params: {
    departmentId?: string;
    search?: string;
    employmentStatus?: EmploymentStatus;
    limit?: number;
    offset?: number;
  }
) {
  return withTenantContext(organisationId, async (tx) => {
    const where: Prisma.UserWhereInput = scopedToOrg(organisationId, {
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.employmentStatus ? { employmentStatus: params.employmentStatus } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { employeeNumber: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    });

    const [total, users] = await Promise.all([
      tx.user.count({ where }),
      tx.user.findMany({
        where,
        select: {
          id: true,
          organisationId: true,
          name: true,
          email: true,
          employeeNumber: true,
          role: true,
          employmentStatus: true,
          departmentId: true,
          department: {
            select: { id: true, name: true },
          },
          managerId: true,
          manager: {
            select: { id: true, name: true, email: true },
          },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 100,
        skip: params.offset ?? 0,
      }),
    ]);

    return { total, users };
  });
}

export async function updateEmployee(
  actingUserId: string,
  organisationId: string,
  employeeId: string,
  input: UpdateEmployeeInput
) {
  return withTenantContext(organisationId, async (tx) => {
    const existing = await tx.user.findFirst({
      where: scopedToOrg(organisationId, { id: employeeId }),
    });

    if (!existing) {
      const error = new Error('Employee not found in organisation');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    if (input.departmentId) {
      const dept = await tx.department.findFirst({
        where: scopedToOrg(organisationId, { id: input.departmentId }),
      });
      if (!dept) {
        const error = new Error('Department not found in organisation');
        (error as any).statusCode = 400;
        (error as any).code = 'INVALID_DEPARTMENT';
        throw error;
      }
    }

    if (input.managerId !== undefined && input.managerId !== null) {
      if (input.managerId === employeeId) {
        const error = new Error('Employee cannot be their own manager');
        (error as any).statusCode = 400;
        (error as any).code = 'INVALID_MANAGER';
        throw error;
      }
      const mgr = await tx.user.findFirst({
        where: scopedToOrg(organisationId, { id: input.managerId }),
      });
      if (!mgr) {
        const error = new Error('Manager not found in organisation');
        (error as any).statusCode = 400;
        (error as any).code = 'INVALID_MANAGER';
        throw error;
      }
    }

    const isDeactivating =
      input.employmentStatus === EmploymentStatus.INACTIVE &&
      existing.employmentStatus !== EmploymentStatus.INACTIVE;

    const updated = await tx.user.update({
      where: { id: employeeId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.departmentId ? { departmentId: input.departmentId } : {}),
        ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.employmentStatus ? { employmentStatus: input.employmentStatus } : {}),
      },
      select: {
        id: true,
        organisationId: true,
        name: true,
        email: true,
        employeeNumber: true,
        role: true,
        employmentStatus: true,
        departmentId: true,
        managerId: true,
      },
    });

    if (isDeactivating) {
      await createAuditLog(tx, {
        userId: actingUserId,
        action: 'employee.deactivate',
        resourceId: updated.id,
        metadata: {
          employeeNumber: updated.employeeNumber,
          previousStatus: existing.employmentStatus,
        },
      });
    }

    return updated;
  });
}

export interface ImportRow {
  name?: string;
  email?: string;
  employeeNumber?: string;
  department?: string;
  role?: string;
  managerEmail?: string;
}

export interface ImportResult {
  imported: Array<{
    id: string;
    name: string;
    email: string;
    employeeNumber: string;
  }>;
  rejected: Array<{
    row: number;
    data: any;
    reason: string;
  }>;
}

export async function importEmployees(
  actingUserId: string,
  organisationId: string,
  buffer: Buffer,
  format: 'csv' | 'xlsx'
): Promise<ImportResult> {
  const rows: ImportRow[] = [];

  if (format === 'csv') {
    const rawRecords = parseCsv(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;
    for (const rec of rawRecords) {
      rows.push({
        name: rec.name || rec.Name || rec['Full Name'],
        email: rec.email || rec.Email || rec['Email Address'],
        employeeNumber: rec.employeeNumber || rec.EmployeeNumber || rec['Employee ID'] || rec['Employee Number'],
        department: rec.department || rec.Department || rec['Department Name'],
        role: rec.role || rec.Role,
        managerEmail: rec.managerEmail || rec.ManagerEmail || rec['Manager Email'],
      });
    }
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    if (worksheet) {
      const headers: string[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value?.toString().trim() || '';
          });
        } else {
          const rowData: Record<string, any> = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
              rowData[header] = cell.value?.toString().trim();
            }
          });
          rows.push({
            name: rowData.name || rowData.Name || rowData['Full Name'],
            email: rowData.email || rowData.Email || rowData['Email Address'],
            employeeNumber:
              rowData.employeeNumber ||
              rowData.EmployeeNumber ||
              rowData['Employee ID'] ||
              rowData['Employee Number'],
            department: rowData.department || rowData.Department || rowData['Department Name'],
            role: rowData.role || rowData.Role,
            managerEmail: rowData.managerEmail || rowData.ManagerEmail || rowData['Manager Email'],
          });
        }
      });
    }
  }

  const imported: ImportResult['imported'] = [];
  const rejected: ImportResult['rejected'] = [];

  // Pre-load departments in organisation for fast resolution
  const existingDepartments = await withTenantContext(organisationId, async (tx) => {
    return tx.department.findMany({
      where: scopedToOrg(organisationId),
    });
  });
  const deptMap = new Map<string, string>();
  for (const dept of existingDepartments) {
    deptMap.set(dept.name.toLowerCase().trim(), dept.id);
    deptMap.set(dept.id, dept.id);
  }

  const seenEmails = new Set<string>();
  const seenEmpNos = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // account for 1-based index and header row
    const row = rows[i];

    if (!row.name || !row.email || !row.employeeNumber || !row.department) {
      rejected.push({
        row: rowNum,
        data: row,
        reason: 'Missing required field (name, email, employeeNumber, or department)',
      });
      continue;
    }

    const email = row.email.toLowerCase().trim();
    const employeeNumber = row.employeeNumber.trim();

    if (!email.includes('@') || !email.includes('.')) {
      rejected.push({
        row: rowNum,
        data: row,
        reason: 'Invalid email format',
      });
      continue;
    }

    if (seenEmails.has(email)) {
      rejected.push({
        row: rowNum,
        data: row,
        reason: 'Duplicate email within import file',
      });
      continue;
    }

    if (seenEmpNos.has(employeeNumber)) {
      rejected.push({
        row: rowNum,
        data: row,
        reason: 'Duplicate employeeNumber within import file',
      });
      continue;
    }

    // Resolve department
    let departmentId = deptMap.get(row.department.toLowerCase().trim());
    if (!departmentId) {
      // Auto-create department if not found
      const newDept = await withTenantContext(organisationId, async (tx) => {
        return tx.department.create({
          data: {
            organisationId,
            name: row.department!.trim(),
          },
        });
      });
      departmentId = newDept.id;
      deptMap.set(newDept.name.toLowerCase().trim(), newDept.id);
      deptMap.set(newDept.id, newDept.id);
    }

    // Validate role
    let role: Role = Role.LEARNER;
    if (row.role) {
      const normalizedRole = row.role.toUpperCase().trim();
      if (normalizedRole === 'MANAGER') role = Role.MANAGER;
      else if (normalizedRole === 'ORG_ADMIN') role = Role.ORG_ADMIN;
      else if (normalizedRole === 'LEARNER') role = Role.LEARNER;
    }

    try {
      const emp = await createEmployee(actingUserId, organisationId, {
        name: row.name,
        email,
        employeeNumber,
        departmentId,
        role,
        employmentStatus: EmploymentStatus.ACTIVE,
      });

      seenEmails.add(email);
      seenEmpNos.add(employeeNumber);

      imported.push({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        employeeNumber: emp.employeeNumber,
      });
    } catch (err: any) {
      rejected.push({
        row: rowNum,
        data: row,
        reason: err.message || 'Failed to create employee',
      });
    }
  }

  return { imported, rejected };
}
