import { pool } from '../config/database.js';
import type { Database } from '../utils/database.js';
import type { Sector } from './entities.js';

export function listAll(db: Database = pool) {
  return db.query<Sector>('SELECT id, name, slug, active FROM sectors ORDER BY name');
}

export function listAssigned(values: [profileId: string], db: Database = pool) {
  return db.query<Sector>(
    'SELECT s.id, s.name, s.slug, s.active FROM sectors s JOIN sector_managers sm ON sm.sector_id = s.id WHERE sm.profile_id = $1 ORDER BY s.name',
    values,
  );
}

export function listPublic(db: Database = pool) {
  return db.query<Sector>(
    "SELECT s.id, s.name, s.slug, s.active FROM sectors s JOIN surveys sv ON sv.sector_id = s.id WHERE s.active = true AND sv.status = 'published' ORDER BY s.name",
  );
}

export function insert(values: [name: string, slug: string], db: Database = pool) {
  return db.query<Sector>(
    'INSERT INTO sectors (name, slug) VALUES ($1, $2) RETURNING id, name, slug, active',
    values,
  );
}
