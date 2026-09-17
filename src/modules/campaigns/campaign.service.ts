import {
  AudienceType,
  CampaignStatus,
  CourseStatus,
  EmploymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { prisma } from '../../db/client.js';
import { scopedToOrg, withTenantContext } from '../../db/tenant.js';
import { createAuditLog } from '../audit/audit.service.js';

export interface CreateCampaignInput {
  name: string;
  courseId: string;
  audienceType: AudienceType;
  departmentId?: string | null;
  selectedUserIds?: string[];
  deadline: string | Date;
  passMark: number;
  certificateEnabled?: boolean;
}

export async function createDraftCampaign(
  organisationId: string,
  input: CreateCampaignInput
) {
  return withTenantContext(organisationId, async (tx) => {
    // Check course exists in organisation
    const course = await tx.course.findFirst({
      where: scopedToOrg(organisationId, { id: input.courseId }),
    });

    if (!course) {
      const error = new Error('Course not found in organisation');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    // Default certificateEnabled from course if not explicitly set
    const certificateEnabled =
      input.certificateEnabled !== undefined
        ? input.certificateEnabled
        : course.certificateEnabled;

    const campaign = await tx.campaign.create({
      data: {
        organisationId,
        courseId: input.courseId,
        name: input.name.trim(),
        audienceType: input.audienceType,
        departmentId: input.departmentId || null,
        status: CampaignStatus.DRAFT,
        deadline: new Date(input.deadline),
        passMark: input.passMark,
        certificateEnabled,
      },
    });

    if (
      input.audienceType === AudienceType.SELECTED_EMPLOYEES &&
      input.selectedUserIds &&
      input.selectedUserIds.length > 0
    ) {
      await tx.campaignSelectedUser.createMany({
        data: input.selectedUserIds.map((userId) => ({
          campaignId: campaign.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    // Saving as Draft skips assignment creation entirely (FR-023)
    return campaign;
  });
}

export async function launchCampaign(
  actingUserId: string,
  organisationId: string,
  campaignId: string
) {
  return withTenantContext(organisationId, async (tx) => {
    const campaign = await tx.campaign.findFirst({
      where: scopedToOrg(organisationId, { id: campaignId }),
      include: {
        course: true,
        selectedUsers: true,
      },
    });

    if (!campaign) {
      const error = new Error('Campaign not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    if (campaign.status === CampaignStatus.ACTIVE) {
      const error = new Error('Campaign is already active');
      (error as any).statusCode = 400;
      (error as any).code = 'CAMPAIGN_ALREADY_ACTIVE';
      throw error;
    }

    // Section 5: Validation 1 — course.status === 'PUBLISHED'
    if (campaign.course.status !== CourseStatus.PUBLISHED) {
      const error = new Error('Cannot launch campaign: Course is not published');
      (error as any).statusCode = 400;
      (error as any).code = 'COURSE_NOT_PUBLISHED';
      throw error;
    }

    // Section 5: Validation 2 — 1 <= passMark <= 100 and is an integer
    if (
      typeof campaign.passMark !== 'number' ||
      !Number.isInteger(campaign.passMark) ||
      Number.isNaN(campaign.passMark) ||
      campaign.passMark < 1 ||
      campaign.passMark > 100
    ) {
      const error = new Error('Cannot launch campaign: passMark must be an integer between 1 and 100');
      (error as any).statusCode = 400;
      (error as any).code = 'INVALID_PASS_MARK';
      throw error;
    }

    // Section 5: Validation 3 — deadline is a valid future-or-present date
    const now = new Date();
    const deadlineDate = new Date(campaign.deadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate < now) {
      const error = new Error('Cannot launch campaign: deadline must be a valid future or present date');
      (error as any).statusCode = 400;
      (error as any).code = 'DEADLINE_IN_PAST';
      throw error;
    }

    // Section 5: Validation 4 — Resolve eligible population per audience type
    let eligibleUsers: Array<{ id: string }> = [];

    if (campaign.audienceType === AudienceType.ALL_EMPLOYEES) {
      // base eligibility = organisation.users WHERE employmentStatus != 'INACTIVE' AND role NOT IN ('ORG_ADMIN', 'SUPER_ADMIN')
      eligibleUsers = await tx.user.findMany({
        where: scopedToOrg(organisationId, {
          employmentStatus: { not: EmploymentStatus.INACTIVE },
          role: { notIn: [Role.ORG_ADMIN, Role.SUPER_ADMIN] },
        }),
        select: { id: true },
      });
    } else if (campaign.audienceType === AudienceType.DEPARTMENT) {
      if (!campaign.departmentId) {
        const error = new Error('Department ID is required for DEPARTMENT audience campaign');
        (error as any).statusCode = 400;
        (error as any).code = 'MISSING_DEPARTMENT';
        throw error;
      }
      eligibleUsers = await tx.user.findMany({
        where: scopedToOrg(organisationId, {
          departmentId: campaign.departmentId,
          employmentStatus: { not: EmploymentStatus.INACTIVE },
          role: { notIn: [Role.ORG_ADMIN, Role.SUPER_ADMIN] },
        }),
        select: { id: true },
      });
    } else if (campaign.audienceType === AudienceType.SELECTED_EMPLOYEES) {
      // SELECTED_EMPLOYEES: users WHERE id IN campaign.selectedUsers
      // (no other filter — an explicit selection overrides department/status defaults)
      const selectedIds = campaign.selectedUsers.map((su) => su.userId);
      if (selectedIds.length > 0) {
        eligibleUsers = await tx.user.findMany({
          where: scopedToOrg(organisationId, {
            id: { in: selectedIds },
          }),
          select: { id: true },
        });
      }
    }

    if (eligibleUsers.length === 0) {
      const error = new Error('Cannot launch campaign: resolved audience has zero eligible learners');
      (error as any).statusCode = 400;
      (error as any).code = 'NO_ELIGIBLE_LEARNERS';
      throw error;
    }

    // Step 5: If all checks pass, set status = ACTIVE
    const updatedCampaign = await tx.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.ACTIVE },
    });

    // Create Assignment rows:
    // status = ASSIGNED, courseVersion copied from course, deadline copied from campaign
    const assignmentData = eligibleUsers.map((u) => ({
      campaignId: campaign.id,
      userId: u.id,
      status: 'ASSIGNED' as const,
      courseVersion: campaign.course.courseVersion,
      deadline: campaign.deadline,
    }));

    await tx.assignment.createMany({
      data: assignmentData,
      skipDuplicates: true,
    });

    // Write one AuditLog row per launch
    await createAuditLog(tx, {
      userId: actingUserId,
      action: 'campaign.launch',
      resourceId: campaign.id,
      metadata: {
        campaignName: campaign.name,
        courseId: campaign.courseId,
        courseVersion: campaign.course.courseVersion,
        passMark: campaign.passMark,
        audienceType: campaign.audienceType,
        assignmentsCount: eligibleUsers.length,
      },
    });

    return {
      campaign: updatedCampaign,
      assignmentsCreated: eligibleUsers.length,
    };
  });
}

export async function listCampaigns(organisationId: string) {
  return withTenantContext(organisationId, async (tx) => {
    return tx.campaign.findMany({
      where: scopedToOrg(organisationId),
      include: {
        course: {
          select: { id: true, title: true, courseVersion: true, status: true },
        },
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
}

export async function getCampaignAssignments(
  organisationId: string,
  campaignId: string
) {
  return withTenantContext(organisationId, async (tx) => {
    const campaign = await tx.campaign.findFirst({
      where: scopedToOrg(organisationId, { id: campaignId }),
    });

    if (!campaign) {
      const error = new Error('Campaign not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    return tx.assignment.findMany({
      where: { campaignId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeNumber: true,
            department: { select: { id: true, name: true } },
          },
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
  });
}
