import { pool } from '../config/database.js';
import type { Database } from '../utils/database.js';
import type { Complaint } from './entities.js';

export function list(
  values: [
    global: boolean,
    profileId: string,
    sectorId: string | null,
    status: Complaint['status'] | null,
    limit: number,
    offset: number,
  ],
  db: Database = pool,
) {
  return db.query<Complaint>(
    `SELECT c.id, c.response_id, c.comment, c.contact, c.contact_consent, c.status, c.created_at, sv.sector_id FROM complaints c JOIN responses r ON r.id = c.response_id JOIN surveys sv ON sv.id = r.survey_id WHERE ($1::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $2)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::complaint_status IS NULL OR c.status = $4) ORDER BY c.created_at DESC LIMIT $5 OFFSET $6`,
    values,
  );
}

export function findOwner(values: [id: string], db: Database = pool) {
  return db.query<{ sector_id: string }>(
    'SELECT sv.sector_id FROM complaints c JOIN responses r ON r.id = c.response_id JOIN surveys sv ON sv.id = r.survey_id WHERE c.id = $1',
    values,
  );
}

export function updateStatus(
  values: [id: string, status: Complaint['status']],
  db: Database = pool,
) {
  return db.query<Pick<Complaint, 'id' | 'status' | 'updated_at'>>(
    'UPDATE complaints SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, status, updated_at',
    values,
  );
}
