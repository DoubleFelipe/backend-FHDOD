import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'), PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(), MIGRATION_DATABASE_URL: z.string().url().optional(),
  DATABASE_CA_CERT_PATH: z.string().optional(), DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000), DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  ACCESS_TOKEN_SECRET: z.string().min(32), REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900), REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'), RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100), RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5), PUBLIC_SUBMISSION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  PUBLIC_SUBMISSION_MAX_FIELDS: z.coerce.number().int().positive().max(100).default(30), PUBLIC_SUBMISSION_MAX_TEXT_LENGTH: z.coerce.number().int().positive().max(10000).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).superRefine((values, context) => {
  if (values.NODE_ENV === 'production' && !values.DATABASE_CA_CERT_PATH) context.addIssue({ code: 'custom', path: ['DATABASE_CA_CERT_PATH'], message: 'A trusted PostgreSQL CA certificate is required in production' });
  if (values.ACCESS_TOKEN_SECRET === values.REFRESH_TOKEN_SECRET) context.addIssue({ code: 'custom', path: ['REFRESH_TOKEN_SECRET'], message: 'Token secrets must be distinct' });
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const keys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid environment configuration. Check: ${keys}`);
}
export const config = parsed.data;
export const corsOrigins = config.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
