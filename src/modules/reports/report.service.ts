import { AssignmentStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../db/client.js';
import { scopedToOrg, withTenantContext } from '../../db/tenant.js';
import { createAuditLog } from '../audit/audit.service.js';
import ExcelJS from 'exceljs';

export interface ReportFilterParams {
  campaignId?: string;
  departmentId?: string;
  status?: AssignmentStatus;
  startDate?: string;
  endDate?: string;
  isOverdue?: boolean;
}

export async function getAssignmentsReport(
  user: { id: string; role: Role; organisationId: string },
  filters: ReportFilterParams
) {
  return withTenantContext(user.organisationId, async (tx) => {
    const now = new Date();

    // Base WHERE condition: scoped to organisation
    const where: Prisma.AssignmentWhereInput = {
      campaign: {
        organisationId: user.organisationId,
      },
      user: {
        organisationId: user.organisationId,
        // Manager row-level scoping per §2.2:
        ...(user.role === Role.MANAGER ? { managerId: user.id } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            assignedAt: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
    };

    // If filter specifically requests overdue
    if (filters.isOverdue === true) {
      where.deadline = { lt: now };
      where.status = { not: AssignmentStatus.PASSED };
    }

    const assignments = await tx.assignment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeNumber: true,
            department: { select: { id: true, name: true } },
            manager: { select: { id: true, name: true } },
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            passMark: true,
            course: { select: { id: true, title: true } },
          },
        },
        attempts: {
          select: { id: true, attemptNumber: true, score: true, result: true, submittedAt: true },
          orderBy: { attemptNumber: 'desc' },
        },
        certificate: {
          select: {
            id: true,
            certificateNumber: true,
            verificationCode: true,
            completionDate: true,
            completedLate: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    // Compute summary aggregates strictly from this filtered set (QA requirement)
    const totalAssignments = assignments.length;
    let passedCount = 0;
    let failedCount = 0;
    let inProgressCount = 0;
    let assignedCount = 0;
    let completedCount = 0;
    let overdueCount = 0;
    let totalScore = 0;
    let scoredCount = 0;

    const rows = assignments.map((a) => {
      const isOverdue = a.deadline < now && a.status !== AssignmentStatus.PASSED;

      if (a.status === AssignmentStatus.PASSED) passedCount++;
      else if (a.status === AssignmentStatus.FAILED) failedCount++;
      else if (a.status === AssignmentStatus.IN_PROGRESS || a.status === AssignmentStatus.STARTED) inProgressCount++;
      else if (a.status === AssignmentStatus.ASSIGNED) assignedCount++;
      else if (a.status === AssignmentStatus.COMPLETED) completedCount++;

      if (isOverdue) overdueCount++;

      if (a.score !== null && a.score !== undefined) {
        totalScore += a.score;
        scoredCount++;
      }

      return {
        id: a.id,
        learnerId: a.userId,
        learnerName: a.user.name,
        learnerEmail: a.user.email,
        employeeNumber: a.user.employeeNumber,
        departmentName: a.user.department.name,
        managerName: a.user.manager?.name || null,
        campaignId: a.campaignId,
        campaignName: a.campaign.name,
        courseTitle: a.campaign.course.title,
        status: a.status,
        deadline: a.deadline,
        isOverdue,
        score: a.score,
        passMark: a.campaign.passMark,
        attemptsCount: a.attempts.length,
        certificateNumber: a.certificate?.certificateNumber || null,
        completionDate: a.certificate?.completionDate || null,
        completedLate: a.certificate?.completedLate || (a.completedLateAt !== null),
      };
    });

    const completionRate =
      totalAssignments > 0 ? Math.round((passedCount / totalAssignments) * 100) : 0;
    const averageScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

    const summary = {
      totalAssignments,
      passedCount,
      failedCount,
      inProgressCount,
      assignedCount,
      completedCount,
      overdueCount,
      completionRate,
      averageScore,
    };

    return {
      summary,
      rows,
    };
  });
}

export async function exportAssignmentsReport(
  actingUser: { id: string; role: Role; organisationId: string },
  filters: ReportFilterParams,
  format: 'xlsx' | 'csv' | 'pdf'
) {
  const data = await getAssignmentsReport(actingUser, filters);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Training Compliance Report');

  worksheet.columns = [
    { header: 'Employee Number', key: 'employeeNumber', width: 18 },
    { header: 'Learner Name', key: 'learnerName', width: 22 },
    { header: 'Email', key: 'learnerEmail', width: 26 },
    { header: 'Department', key: 'departmentName', width: 20 },
    { header: 'Manager', key: 'managerName', width: 20 },
    { header: 'Campaign', key: 'campaignName', width: 25 },
    { header: 'Course', key: 'courseTitle', width: 25 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Overdue', key: 'isOverdue', width: 12 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Pass Mark', key: 'passMark', width: 12 },
    { header: 'Attempts', key: 'attemptsCount', width: 12 },
    { header: 'Certificate No', key: 'certificateNumber', width: 25 },
    { header: 'Completed Late', key: 'completedLate', width: 16 },
  ];

  for (const row of data.rows) {
    worksheet.addRow({
      employeeNumber: row.employeeNumber,
      learnerName: row.learnerName,
      learnerEmail: row.learnerEmail,
      departmentName: row.departmentName,
      managerName: row.managerName || 'N/A',
      campaignName: row.campaignName,
      courseTitle: row.courseTitle,
      status: row.status,
      isOverdue: row.isOverdue ? 'YES' : 'NO',
      score: row.score !== null ? `${row.score}%` : 'N/A',
      passMark: `${row.passMark}%`,
      attemptsCount: row.attemptsCount,
      certificateNumber: row.certificateNumber || 'N/A',
      completedLate: row.completedLate ? 'YES' : 'NO',
    });
  }

  // Audit log per Section 8: report.export
  await withTenantContext(actingUser.organisationId, async (tx) => {
    return createAuditLog(tx, {
      userId: actingUser.id,
      action: 'report.export',
      resourceId: null,
      metadata: {
        format,
        totalRows: data.rows.length,
        filters,
      },
    });
  });

  if (format === 'csv') {
    const csvBuffer = await workbook.csv.writeBuffer();
    return {
      buffer: Buffer.from(csvBuffer),
      mimeType: 'text/csv',
      filename: `kaziwise-report-${Date.now()}.csv`,
    };
  }

  // Default to xlsx (or if format is pdf/xlsx)
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(xlsxBuffer),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `kaziwise-report-${Date.now()}.xlsx`,
  };
}
