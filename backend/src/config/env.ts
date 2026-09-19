import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(16).default('local-development-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(16).default('local-development-refresh-secret-change-me'),
});

export const env = envSchema.parse(process.env);
