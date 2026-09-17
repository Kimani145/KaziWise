import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { Role } from '@prisma/client';

export interface TokenPayload {
  sub: string;
  organisationId: string;
  email: string;
  role: Role;
  name: string;
  departmentId: string;
  managerId?: string | null;
}

export interface RefreshPayload {
  sub: string;
  type: 'refresh';
}

export interface ResetPayload {
  sub: string;
  email: string;
  type: 'reset';
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
}

export function signRefreshToken(userId: string): string {
  const payload: RefreshPayload = { sub: userId, type: 'refresh' };
  return jwt.sign(payload, env.REFRESH_JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.REFRESH_JWT_SECRET) as RefreshPayload;
}

export function signPasswordResetToken(userId: string, email: string): string {
  const payload: ResetPayload = { sub: userId, email, type: 'reset' };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
}

export function verifyPasswordResetToken(token: string): ResetPayload {
  return jwt.verify(token, env.JWT_SECRET) as ResetPayload;
}
