import type { PoolClient } from 'pg';
import type { Principal } from '../infrastructure/auth.js';
import { forbidden } from '../domain/errors.js';

export async function assertSectorAccess(client: PoolClient, principal: Principal, sectorId: string): Promise<void> {
  if (principal.role === 'admin' || principal.role === 'ombudsman') return;
  const result = await client.query('SELECT 1 FROM sector_managers WHERE profile_id = $1 AND sector_id = $2', [principal.id, sectorId]);
  if (!result.rowCount) throw forbidden();
}
