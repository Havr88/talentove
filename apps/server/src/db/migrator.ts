import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Pool, PoolClient } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(pool: Pool): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: appliedRows } = await client.query<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC',
    );
    const appliedVersions = new Set(appliedRows.map((r) => r.version));

    const migrationsDir = join(__dirname, 'migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      const match = /^(\d+)_/.exec(file);
      if (!match) continue;
      const version = Number.parseInt(match[1] ?? '0', 10);
      if (appliedVersions.has(version)) continue;

      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      await executeMigration(client, version, file, sql);
      count++;
    }

    return count;
  } finally {
    client.release();
  }
}

async function executeMigration(client: PoolClient, version: number, name: string, sql: string): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, NOW())',
      [version, name],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
