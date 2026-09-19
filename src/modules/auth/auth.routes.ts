import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  confirmPasswordReset,
  loginUser,
  refreshAccessToken,
  requestPasswordReset,
} from './auth.service.js';
import { verifyAccessToken } from '../../auth/jwt.js';
import { withBypassRls } from '../../db/tenant.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /me — Returns current authenticated user profile
  fastify.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const token = authHeader.substring(7);
    try {
      const payload = verifyAccessToken(token);
      const user = await withBypassRls(async (tx) => {
        return tx.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            organisationId: true,
            email: true,
            name: true,
            role: true,
            departmentId: true,
            managerId: true,
            employeeNumber: true,
            employmentStatus: true,
          },
        });
      });

      if (!user || user.employmentStatus === 'INACTIVE') {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'User account is inactive or not found',
        });
      }

      return reply.send(user);
    } catch {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired access token',
      });
    }
  });
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  fastify.post('/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid email or password format',
        details: parseResult.error.format(),
      });
    }

    try {
      const result = await loginUser(parseResult.data);

      reply.setCookie('refreshToken', result.refreshToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      });

      return reply.send({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: err.code || 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  });

  const refreshSchema = z.object({
    refreshToken: z.string().optional(),
  });

  fastify.post('/refresh', async (request, reply) => {
    const body = (request.body as any) || {};
    const cookieToken = request.cookies?.refreshToken;
    const refreshToken = cookieToken || body.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Refresh token is required',
      });
    }

    try {
      const result = await refreshAccessToken(refreshToken);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 401).send({
        error: err.code || 'UNAUTHORIZED',
        message: err.message,
      });
    }
  });

  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('refreshToken', {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
    });
    return reply.send({ success: true, message: 'Logged out successfully' });
  });

  const resetRequestSchema = z.object({
    email: z.string().email(),
  });

  fastify.post('/password-reset/request', async (request, reply) => {
    const parseResult = resetRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid email address',
      });
    }

    const result = await requestPasswordReset(parseResult.data.email);
    return reply.send(result);
  });

  const resetConfirmSchema = z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
  });

  fastify.post('/password-reset/confirm', async (request, reply) => {
    const parseResult = resetConfirmSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid reset confirmation payload. Password must be at least 8 characters.',
      });
    }

    try {
      const result = await confirmPasswordReset(
        parseResult.data.token,
        parseResult.data.newPassword
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        error: err.code || 'BAD_REQUEST',
        message: err.message,
      });
    }
  });

  // Aliases matching frontend client routes
  fastify.post('/forgot-password', async (request, reply) => {
    const parseResult = resetRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid email address',
      });
    }

    const result = await requestPasswordReset(parseResult.data.email);
    return reply.send(result);
  });

  fastify.post('/reset-password', async (request, reply) => {
    const parseResult = resetConfirmSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid reset confirmation payload. Password must be at least 8 characters.',
      });
    }

    try {
      const result = await confirmPasswordReset(
        parseResult.data.token,
        parseResult.data.newPassword
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        error: err.code || 'BAD_REQUEST',
        message: err.message,
      });
    }
  });
};
