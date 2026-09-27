import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const FORBIDDEN_SECRETS = ['cambiar', 'changeme', 'secret', 'password', '123456', 'admin'];

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  TZ: z.literal('America/Caracas').default('America/Caracas'),
  INSTANCE_NAME: z.string().min(1).default('TalentoVe'),

  // PostgreSQL
  DATABASE_URL: z.string().url().default('postgres://talento:talento@localhost:5432/talento'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  // Sesiones y seguridad
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET debe tener al menos 32 caracteres')
    .refine(
      (s) => !FORBIDDEN_SECRETS.includes(s.toLowerCase().trim()),
      'SESSION_SECRET no puede ser un valor de ejemplo o predeterminado inseguro',
    ),
  SESSION_COOKIE_NAME: z.string().min(1).default('tv_sid'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_INACTIVE_WARNING_MINUTES: z.coerce.number().int().positive().default(8),
  SESSION_INACTIVE_LOGOUT_MINUTES: z.coerce.number().int().positive().default(10),

  // Almacenamiento
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(override?: Partial<Record<string, string>>): Env {
  if (override) {
    return envSchema.parse({ ...process.env, ...override });
  }
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}
