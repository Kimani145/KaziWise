import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthUser, requirePermission } from '../../auth/policy.js';
import {
  createDraftCampaign,
  getCampaignAssignments,
  launchCampaign,
  listCampaigns,
} from './campaign.service.js';
import { AudienceType } from '@prisma/client';

export const campaignRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /campaigns
  fastify.get(
    '/',
    { preHandler: [requirePermission('manageCampaigns')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const campaigns = await listCampaigns(user.organisationId);
      return reply.send(campaigns);
    }
  );

  const createCampaignSchema = z.object({
    name: z.string().min(1),
    courseId: z.string().uuid(),
    audienceType: z.nativeEnum(AudienceType),
    departmentId: z.string().uuid().nullable().optional(),
    selectedUserIds: z.array(z.string().uuid()).optional(),
    deadline: z.string().min(1),
    passMark: z.number().int().min(1).max(100),
    certificateEnabled: z.boolean().optional(),
  });

  // POST /campaigns: creates DRAFT campaign, no assignments (FR-023)
  fastify.post(
    '/',
    { preHandler: [requirePermission('manageCampaigns')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const parseResult = createCampaignSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid campaign payload',
          details: parseResult.error.format(),
        });
      }

      try {
        const campaign = await createDraftCampaign(
          user.organisationId,
          parseResult.data
        );
        return reply.status(201).send(campaign);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );

  // POST /campaigns/:id/launch: runs section 5 validations and assignment creation transaction
  fastify.post(
    '/:id/launch',
    { preHandler: [requirePermission('launchCampaigns')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { id } = request.params as { id: string };

      try {
        const result = await launchCampaign(user.id, user.organisationId, id);
        return reply.send(result);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );

  // GET /campaigns/:id/assignments: view assigned learners
  fastify.get(
    '/:id/assignments',
    { preHandler: [requirePermission('manageCampaigns')] },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { id } = request.params as { id: string };

      try {
        const assignments = await getCampaignAssignments(user.organisationId, id);
        return reply.send(assignments);
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  );
};
