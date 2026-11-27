import { pool } from '../config/database.js';
import type { Database } from '../utils/database.js';
import type { Question, QuestionView } from './entities.js';

export function listAll(db: Database = pool) {
  return db.query<QuestionView>(
    'SELECT id, text, kind, sector_id, position, active FROM questions WHERE active = true ORDER BY position, id',
  );
}

export function listAssigned(values: [profileId: string], db: Database = pool) {
  return db.query<QuestionView>(
    'SELECT q.id, q.text, q.kind, q.sector_id, q.position, q.active FROM questions q WHERE q.active = true AND (q.sector_id IS NULL OR q.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $1)) ORDER BY q.position, q.id',
    values,
  );
}

export function insert(
  values: [text: string, position: number, sectorId: string | null],
  db: Database = pool,
) {
  return db.query<QuestionView>(
    "INSERT INTO questions (text, position, sector_id, kind, required) VALUES ($1, $2, $3, 'rating', false) RETURNING id, text, kind, sector_id, position, active",
    values,
  );
}

export function findOwner(values: [id: string], db: Database = pool) {
  return db.query<{ sector_id: string | null }>(
    'SELECT sector_id FROM questions WHERE id = $1',
    values,
  );
}

export function deactivate(values: [id: string, active: false], db: Database = pool) {
  return db.query<Pick<Question, 'id' | 'active'>>(
    "UPDATE questions SET active = $2 WHERE id = $1 AND kind = 'rating' RETURNING id, active",
    values,
  );
}
