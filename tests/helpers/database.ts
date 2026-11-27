import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { vi } from 'vitest';

export const database = await PGlite.create();

// Adapt only the pg transport. Models execute their actual SQL and constraints.
export async function query(sql: string, values?: unknown[]) {
  const result = await database.query(sql, values);
  return {
    ...result,
    rowCount: /^\s*(SELECT|WITH)\b/i.test(sql) ? result.rows.length : result.affectedRows,
  };
}

export const testPool = {
  query: vi.fn(query),
  connect: vi.fn(async () => ({ query, release: vi.fn() })),
  end: vi.fn(async () => undefined),
};

export async function migrate() {
  const directory = resolve('database/migrations');
  for (const filename of (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await database.exec('BEGIN');
    try {
      await database.exec(await readFile(resolve(directory, filename), 'utf8'));
      await database.exec('COMMIT');
    } catch (error) {
      await database.exec('ROLLBACK');
      throw error;
    }
  }
}
