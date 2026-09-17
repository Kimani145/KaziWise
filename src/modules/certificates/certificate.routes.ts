import { FastifyPluginAsync } from 'fastify';
import { withBypassRls } from '../../db/tenant.js';

export const certificateRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /certificates/:id/verify: PUBLIC, no auth required (Section 6)
  fastify.get('/:id/verify', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await withBypassRls(async (tx) => {
      // Find by verificationCode, certificateNumber, or id
      const cert = await tx.certificate.findFirst({
        where: {
          OR: [
            { verificationCode: id.toUpperCase().trim() },
            { certificateNumber: id.trim() },
            { id: id.trim() },
          ],
        },
        include: {
          assignment: {
            include: {
              user: { select: { name: true } },
              campaign: {
                include: {
                  course: { select: { title: true } },
                },
              },
            },
          },
        },
      });

      if (!cert) {
        return {
          valid: false,
          message: 'Certificate not found or verification code is invalid',
        };
      }

      // Strictly return public authenticity fields only — no PII leakage (Section 6)
      return {
        valid: true,
        certificateNumber: cert.certificateNumber,
        learnerName: cert.assignment.user.name,
        courseTitle: cert.assignment.campaign.course.title,
        completionDate: cert.completionDate,
        completedLate: cert.completedLate,
      };
    });

    if (!result.valid) {
      return reply.status(404).send(result);
    }

    return reply.send(result);
  });
};
