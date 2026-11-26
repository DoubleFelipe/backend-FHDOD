import { pool } from '../config/database.js';
import type { Database } from '../utils/database.js';

export type MetricsParameters = [
  profileId: string,
  global: boolean,
  sectorId: string | null,
  from: string | null,
  to: string | null,
  shift: 'morning' | 'afternoon' | 'night' | null,
];

export function findResponses(values: MetricsParameters, db: Database = pool) {
  return db.query<{ nps: number; sector_id: string; sector_name: string }>(
    `SELECT r.nps, sv.sector_id, s.name AS sector_name FROM responses r JOIN surveys sv ON sv.id = r.survey_id JOIN sectors s ON s.id = sv.sector_id WHERE ($2::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $1)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) >= $4) AND ($5::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) < $5) AND ($6::work_shift IS NULL OR r.shift = $6)`,
    values,
  );
}

export function findRatings(values: MetricsParameters, db: Database = pool) {
  return db.query<{ value: number; sector_id: string }>(
    `SELECT a.value, sv.sector_id FROM answers a JOIN responses r ON r.id = a.response_id JOIN surveys sv ON sv.id = r.survey_id JOIN questions q ON q.id = a.question_id WHERE q.kind = 'rating' AND ($2::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $1)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) >= $4) AND ($5::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) < $5) AND ($6::work_shift IS NULL OR r.shift = $6)`,
    values,
  );
}

export function findPublicResponses(db: Database = pool) {
  return db.query<{ nps: number }>('SELECT nps FROM responses');
}

export function findPublicRatings(db: Database = pool) {
  return db.query<{ value: number }>('SELECT value FROM answers');
}
