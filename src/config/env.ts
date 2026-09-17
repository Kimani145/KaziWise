import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16).default('kaziwise-super-secure-production-jwt-secret-key-32chars'),
  REFRESH_JWT_SECRET: z.string().min(16).default('kaziwise-super-secure-production-refresh-jwt-secret-key-32chars'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);
