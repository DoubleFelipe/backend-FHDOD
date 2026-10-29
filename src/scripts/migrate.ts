import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { config } from '../config.js';

if (!config.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required to run migrations');
const client = new pg.Client({ connectionString: config.MIGRATION_DATABASE_URL });
try {
  await client.connect();
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = resolve(process.cwd(), 'database/migrations');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (existing.rowCount) continue;
    await client.query('BEGIN');
    try { await client.query(await readFile(resolve(directory, file), 'utf8')); await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    console.info(`Applied migration ${file}`);
  }
} finally { await client.end(); }
