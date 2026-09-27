import { Pool } from 'pg';
import { createClient } from '@libsql/client';
import { getEnv } from './config/env.js';
import { createPgRepositories } from './db/pg-repositories.js';
import { createDrizzleRepositories } from './db/drizzle-repositories.js';
import { initSqliteSchema } from './db/drizzle-migrator.js';
import { runMigrations } from './db/migrator.js';
import { createApp } from './app.js';
import type { Repositories } from './db/types.js';

async function main() {
  const env = getEnv();
  let repos: Repositories;

  const isPostgres = env.DATABASE_URL.startsWith('postgres://') || env.DATABASE_URL.startsWith('postgresql://');

  if (isPostgres) {
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    });

    const applied = await runMigrations(pool);
    if (applied > 0) {
      process.stdout.write(`Se aplicaron ${applied} migraciones en PostgreSQL.\n`);
    }

    repos = createPgRepositories(pool);
    process.stdout.write(`[BD] Conectado a PostgreSQL.\n`);
  } else {
    // Motor Drizzle ORM sobre SQLite con WAL mode
    const client = createClient({ url: env.DATABASE_URL });
    await initSqliteSchema(client);
    repos = createDrizzleRepositories(client);
    process.stdout.write(`[BD] Drizzle ORM activo sobre SQLite WAL (${env.DATABASE_URL})\n`);
  }

  const app = createApp(repos, env);

  app.listen(env.PORT, () => {
    process.stdout.write(`[${env.INSTANCE_NAME}] Servidor iniciado en ${env.BASE_URL} (TZ=${env.TZ})\n`);
  });
}

if (process.env['NODE_ENV'] !== 'test') {
  main().catch((err) => {
    process.stderr.write(`Error fatal al iniciar servidor: ${err.message}\n`);
    process.exit(1);
  });
}
