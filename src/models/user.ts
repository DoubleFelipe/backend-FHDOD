import { pool } from '../config/database.js';
import type { Database } from '../utils/database.js';
import type { ManagedProfile, SectorAssignment } from './entities.js';

export function list(db: Database = pool) {
  return db.query<ManagedProfile>(
    'SELECT id, email, full_name, role, active, must_change_password AS "mustChangePassword", created_at FROM profiles ORDER BY full_name, email',
  );
}

export function insert(
  values: [email: string, fullName: string, hash: string, role: ManagedProfile['role']],
  db: Database = pool,
) {
  return db.query<ManagedProfile>(
    'INSERT INTO profiles (email, full_name, password_hash, role, active, must_change_password) VALUES ($1, $2, $3, $4, true, true) RETURNING id, email, full_name, role, active, must_change_password AS "mustChangePassword", created_at',
    values,
  );
}

export function assignSectors(
  values: [profileId: string, sectorIds: string[]],
  db: Database = pool,
) {
  return db.query<SectorAssignment>(
    'INSERT INTO sector_managers (profile_id, sector_id) SELECT $1, requested.sector_id FROM unnest($2::uuid[]) AS requested(sector_id) JOIN sectors s ON s.id = requested.sector_id AND s.active = true',
    values,
  );
}

export function countAssignments(values: [profileId: string], db: Database = pool) {
  return db.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM sector_managers WHERE profile_id = $1',
    values,
  );
}
