import { Pool } from 'pg';
import { getEnv } from './config/env.js';
import { createPgRepositories } from './db/pg-repositories.js';
import { runMigrations } from './db/migrator.js';
import { createApp } from './app.js';

async function main() {
  const env = getEnv();

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
  });

  // Ejecución de migraciones automáticas al arrancar
  const applied = await runMigrations(pool);
  if (applied > 0) {
    process.stdout.write(`Se aplicaron ${applied} migraciones en PostgreSQL.\n`);
  }

  const repos = createPgRepositories(pool);
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
