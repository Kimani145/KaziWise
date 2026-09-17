import { prisma } from '../../db/client.js';
import { withBypassRls } from '../../db/tenant.js';
import {
  comparePassword,
  hashPassword,
  signAccessToken,
  signPasswordResetToken,
  signRefreshToken,
  verifyAccessToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
} from '../../auth/jwt.js';

export async function loginUser(credentials: { email: string; password: string }) {
  const user = await withBypassRls(async (tx) => {
    return tx.user.findUnique({
      where: { email: credentials.email.toLowerCase().trim() },
      include: { organisation: true, department: true },
    });
  });

  if (!user) {
    const error = new Error('Invalid email or password');
    (error as any).statusCode = 401;
    (error as any).code = 'INVALID_CREDENTIALS';
    throw error;
  }

  if (user.employmentStatus === 'INACTIVE') {
    const error = new Error('User account is inactive');
    (error as any).statusCode = 403;
    (error as any).code = 'ACCOUNT_INACTIVE';
    throw error;
  }

  const passwordValid = await comparePassword(credentials.password, user.passwordHash);
  if (!passwordValid) {
    const error = new Error('Invalid email or password');
    (error as any).statusCode = 401;
    (error as any).code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const accessToken = signAccessToken({
    sub: user.id,
    organisationId: user.organisationId,
    email: user.email,
    role: user.role,
    name: user.name,
    departmentId: user.departmentId,
    managerId: user.managerId,
  });

  const refreshToken = signRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      organisationId: user.organisationId,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      managerId: user.managerId,
      employeeNumber: user.employeeNumber,
      employmentStatus: user.employmentStatus,
    },
  };
}

export async function refreshAccessToken(refreshTokenString: string) {
  try {
    const payload = verifyRefreshToken(refreshTokenString);
    const user = await withBypassRls(async (tx) => {
      return tx.user.findUnique({
        where: { id: payload.sub },
      });
    });

    if (!user || user.employmentStatus === 'INACTIVE') {
      const error = new Error('User not found or inactive');
      (error as any).statusCode = 401;
      (error as any).code = 'INVALID_REFRESH_TOKEN';
      throw error;
    }

    const accessToken = signAccessToken({
      sub: user.id,
      organisationId: user.organisationId,
      email: user.email,
      role: user.role,
      name: user.name,
      departmentId: user.departmentId,
      managerId: user.managerId,
    });

    return { accessToken };
  } catch (err: any) {
    const error = new Error('Invalid or expired refresh token');
    (error as any).statusCode = 401;
    (error as any).code = 'INVALID_REFRESH_TOKEN';
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const user = await withBypassRls(async (tx) => {
    return tx.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  });

  if (!user || user.employmentStatus === 'INACTIVE') {
    // For security, always return success message even if email not found
    return {
      message: 'If the email exists, a password reset link has been sent.',
      token: null,
    };
  }

  const resetToken = signPasswordResetToken(user.id, user.email);

  return {
    message: 'If the email exists, a password reset link has been sent.',
    token: resetToken,
  };
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  try {
    const payload = verifyPasswordResetToken(token);
    return await withBypassRls(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.email !== payload.email) {
        const error = new Error('Invalid password reset token');
        (error as any).statusCode = 400;
        (error as any).code = 'INVALID_RESET_TOKEN';
        throw error;
      }

      const passwordHash = await hashPassword(newPassword);
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      return { success: true, message: 'Password reset successfully' };
    });
  } catch (err: any) {
    const error = new Error('Invalid or expired password reset token');
    (error as any).statusCode = 400;
    (error as any).code = 'INVALID_RESET_TOKEN';
    throw error;
  }
}
