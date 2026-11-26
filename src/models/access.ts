import { pool } from '../config/database.js';
import type { Database } from '../utils/database.js';

export function findAssignment(values: [profileId: string, sectorId: string], db: Database = pool) {
  return db.query<{ exists: number }>(
    'SELECT 1 AS exists FROM sector_managers WHERE profile_id = $1 AND sector_id = $2',
    values,
  );
}
