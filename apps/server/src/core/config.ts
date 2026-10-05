import { z } from 'zod';

// Fail-fast: la configuración se valida al arranque (AGENTS.md).
// DEMO_MODE: vista previa sin PostgreSQL (fixtures en memoria). Producción exige DATABASE_URL.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'demo', 'production']).default('demo'),
  PORT: z.coerce.number().int().positive().default(3000),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  TZ: z.string().default('America/Caracas'),
  DEMO_MODE: z.coerce.boolean().default(true),
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().default('demo-secret-cambiar-en-produccion'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuración inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
