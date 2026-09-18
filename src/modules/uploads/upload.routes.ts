import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthUser, requirePermission } from '../../auth/policy.js';
import { prisma } from '../../db/client.js';
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

// In-memory mock storage for S3 uploads during development / testing
export const storageFiles = new Map<string, { buffer: Buffer; contentType: string }>();

export function generateStorageSignedUrl(objectKey: string, expiresInMs = 15 * 60 * 1000): string {
  const expiresAt = Date.now() + expiresInMs;
  const token = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'secret')
    .update(`${objectKey}:${expiresAt}`)
    .digest('hex');

  return `/api/v1/uploads/storage/${objectKey}?token=${token}&expires=${expiresAt}`;
}

export function verifyStorageToken(objectKey: string, token: string, expires: number): boolean {
  if (Date.now() > expires) {
    return false;
  }
  const expectedToken = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'secret')
    .update(`${objectKey}:${expires}`)
    .digest('hex');
  return token === expectedToken;
}

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // Allow raw buffers for PUT uploads
  fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  const signSchema = z.object({
    filename: z.string().min(1),
    contentType: z.string().min(1),
    fileSize: z.number().positive().max(MAX_FILE_SIZE),
    contentBlockId: z.string().min(1),
  });

  // POST /uploads/sign
  fastify.post(
    '/sign',
    { preHandler: requirePermission('authorCourses') },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const parseResult = signSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid upload request',
          details: parseResult.error.format(),
        });
      }

      const { filename, contentType, fileSize, contentBlockId } = parseResult.data;

      if (!ALLOWED_MIME_TYPES.has(contentType)) {
        return reply.status(400).send({
          error: 'INVALID_FILE_TYPE',
          message: `MIME type ${contentType} is not permitted. Allowed: PDF, Images, Video.`,
        });
      }

      // If contentBlockId exists in DB, verify it belongs to requester's organisation
      const existingBlock = await prisma.contentBlock.findUnique({
        where: { id: contentBlockId },
        include: {
          lesson: {
            include: {
              module: {
                include: {
                  course: true,
                },
              },
            },
          },
        },
      });

      if (existingBlock && existingBlock.lesson.module.course.organisationId !== user.organisationId) {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Content block belongs to another organisation',
        });
      }

      const cleanFilename = filename.split('/').pop()?.split('\\').pop() || filename;
      const objectKey = `${user.organisationId}/${contentBlockId}/${cleanFilename}`;

      const uploadUrl = generateStorageSignedUrl(objectKey, 15 * 60 * 1000);
      const downloadUrl = generateStorageSignedUrl(objectKey, 15 * 60 * 1000);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return reply.send({
        key: objectKey,
        uploadUrl,
        downloadUrl,
        contentType,
        maxSizeBytes: MAX_FILE_SIZE,
        expiresAt,
      });
    }
  );

  // PUT /uploads/storage/*
  fastify.put('/storage/*', async (request, reply) => {
    const objectKey = (request.params as any)['*'];
    const { token, expires } = request.query as { token?: string; expires?: string };

    if (!token || !expires) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Signature token and expiry are required',
      });
    }

    const expiresNum = Number(expires);
    if (!verifyStorageToken(objectKey, token, expiresNum)) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Invalid signature token or link has expired',
      });
    }

    const buffer = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(String(request.body || ''));
    const contentType = (request.headers['content-type'] as string) || 'application/octet-stream';

    storageFiles.set(objectKey, { buffer, contentType });
    return reply.status(200).send({ success: true, key: objectKey });
  });

  // GET /uploads/storage/*
  fastify.get('/storage/*', async (request, reply) => {
    const objectKey = (request.params as any)['*'];
    const { token, expires } = request.query as { token?: string; expires?: string };

    if (!token || !expires) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Signature token and expiry are required',
      });
    }

    const expiresNum = Number(expires);
    if (!verifyStorageToken(objectKey, token, expiresNum)) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Invalid signature token or link has expired',
      });
    }

    const file = storageFiles.get(objectKey);
    if (file) {
      return reply.type(file.contentType).send(file.buffer);
    }

    return reply.type('application/octet-stream').send(Buffer.from('MOCK_STORAGE_DATA'));
  });
};
