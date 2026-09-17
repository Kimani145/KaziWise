import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthUser, requirePermission } from '../../auth/policy.js';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // Only authorCourses or manageEmployees can sign uploads
  fastify.addHook('preHandler', requirePermission('authorCourses'));

  const signSchema = z.object({
    filename: z.string().min(1),
    contentType: z.string().min(1),
    fileSize: z.number().positive().max(MAX_FILE_SIZE),
  });

  // POST /uploads/sign
  fastify.post('/sign', async (request, reply) => {
    const user = request.user as AuthUser;
    const parseResult = signSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid upload request',
        details: parseResult.error.format(),
      });
    }

    const { filename, contentType, fileSize } = parseResult.data;

    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return reply.status(400).send({
        error: 'INVALID_FILE_TYPE',
        message: `MIME type ${contentType} is not permitted. Allowed: PDF, Images, Video.`,
      });
    }

    const fileExtension = filename.split('.').pop() || 'bin';
    const randomKey = crypto.randomBytes(16).toString('hex');
    const objectKey = `${user.organisationId}/${randomKey}.${fileExtension}`;

    // S3-compatible signed URL token
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const token = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'secret')
      .update(`${objectKey}:${expiresAt.getTime()}`)
      .digest('hex');

    const uploadUrl = `/api/v1/uploads/storage/${objectKey}?token=${token}&expires=${expiresAt.getTime()}`;
    const downloadUrl = `/api/v1/uploads/storage/${objectKey}?token=${token}&expires=${expiresAt.getTime()}`;

    return reply.send({
      key: objectKey,
      uploadUrl,
      downloadUrl,
      contentType,
      maxSizeBytes: MAX_FILE_SIZE,
      expiresAt: expiresAt.toISOString(),
    });
  });
};
