import { pool } from '../config/database.js';
import type { Database } from '../utils/database.js';
import type {
  LoginProfile,
  Session,
  SessionPrincipal,
  Profile,
  PublicProfile,
} from './entities.js';

export function findLoginProfile(values: [email: string], db: Database = pool) {
  return db.query<LoginProfile>(
    'SELECT id, email, password_hash, role, must_change_password FROM profiles WHERE email = $1 AND active = true',
    values,
  );
}

export function createSession(
  values: [jti: string, profileId: string, hash: string, expiresAt: Date],
  db: Database = pool,
) {
  return db.query<Session>(
    'INSERT INTO refresh_sessions (jti, profile_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    values,
  );
}

export function lockSession(values: [jti: string, hash: string], db: Database = pool) {
  return db.query<SessionPrincipal>(
    'SELECT p.id, p.role, p.must_change_password FROM refresh_sessions rs JOIN profiles p ON p.id = rs.profile_id WHERE rs.jti = $1 AND rs.token_hash = $2 AND rs.revoked_at IS NULL AND rs.expires_at > now() AND p.active = true FOR UPDATE',
    values,
  );
}

export function revokeSession(values: [jti: string], db: Database = pool) {
  return db.query<Session>('UPDATE refresh_sessions SET revoked_at = now() WHERE jti = $1', values);
}

export function revokeMatchingSession(values: [jti: string, hash: string], db: Database = pool) {
  return db.query<Session>(
    'UPDATE refresh_sessions SET revoked_at = now() WHERE jti = $1 AND token_hash = $2 AND revoked_at IS NULL',
    values,
  );
}

export function findPassword(values: [id: string], db: Database = pool) {
  return db.query<{ password_hash: string }>(
    'SELECT password_hash FROM profiles WHERE id = $1 AND active = true',
    values,
  );
}

export function updatePassword(values: [id: string, hash: string], db: Database = pool) {
  return db.query<Profile>(
    'UPDATE profiles SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1',
    values,
  );
}

export function findProfile(values: [id: string], db: Database = pool) {
  return db.query<PublicProfile>(
    'SELECT id, email, full_name, role, active, must_change_password AS "mustChangePassword" FROM profiles WHERE id = $1 AND active = true',
    values,
  );
}
