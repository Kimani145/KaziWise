import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { verifyAccessToken } from './auth/jwt.js';
import { AuthUser } from './auth/policy.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { employeeRoutes } from './modules/employees/employee.routes.js';
import { departmentRoutes } from './modules/departments/department.routes.js';
import { courseRoutes } from './modules/courses/course.routes.js';
import { campaignRoutes } from './modules/campaigns/campaign.routes.js';
import { assignmentRoutes } from './modules/assignments/assignment.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';
import { reminderRoutes } from './modules/reminders/reminder.routes.js';
import { certificateRoutes } from './modules/certificates/certificate.routes.js';
import { uploadRoutes } from './modules/uploads/upload.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false,
  });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB for imports
    },
  });

  // Health check route
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Global Auth hook for protected routes under /api/v1
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url;

    // Public routes bypass JWT verification
    if (
      url.startsWith('/health') ||
      url.startsWith('/api/v1/auth/') ||
      url.startsWith('/api/v1/uploads/storage/') ||
      /\/api\/v1\/certificates\/[^/]+\/verify/.test(url)
    ) {
      return;
    }

    if (!url.startsWith('/api/v1')) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Bearer token required',
      });
    }

    const token = authHeader.substring(7);
    try {
      const payload = verifyAccessToken(token);
      request.user = {
        id: payload.sub,
        organisationId: payload.organisationId,
        email: payload.email,
        role: payload.role,
        name: payload.name,
        departmentId: payload.departmentId,
        managerId: payload.managerId,
      };
    } catch (err: any) {
      return reply.status(401).send({
        error: 'INVALID_TOKEN',
        message: 'Access token is invalid or expired',
      });
    }
  });

  // Register API v1 routes
  await app.register(
    async (v1) => {
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(employeeRoutes, { prefix: '/employees' });
      await v1.register(departmentRoutes, { prefix: '/departments' });
      await v1.register(courseRoutes, { prefix: '/courses' });
      await v1.register(campaignRoutes, { prefix: '/campaigns' });
      await v1.register(assignmentRoutes, { prefix: '/me' });
      await v1.register(reportRoutes, { prefix: '/reports' });
      await v1.register(reminderRoutes, { prefix: '/assignments' });
      await v1.register(certificateRoutes, { prefix: '/certificates' });
      await v1.register(uploadRoutes, { prefix: '/uploads' });
      await v1.register(auditRoutes, { prefix: '/audit-logs' });
    },
    { prefix: '/api/v1' }
  );

  // Global error handler
  app.setErrorHandler((error: any, request, reply) => {
    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.code || 'HTTP_ERROR',
        message: error.message,
      });
    }

    // Prisma unique constraint violation
    if (error.code === 'P2002') {
      return reply.status(409).send({
        error: 'CONFLICT',
        message: 'A unique constraint was violated',
        target: error.meta?.target,
      });
    }

    // Default 500
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred',
    });
  });

  return app;
}
