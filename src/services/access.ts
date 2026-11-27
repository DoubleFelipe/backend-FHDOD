import * as model from '../models/access.js';
import type { PoolClient } from 'pg';
import type { Principal } from '../infrastructure/auth.js';
import { forbidden } from '../domain/errors.js';

export async function assertSectorAccess(
  client: PoolClient,
  principal: Principal,
  sectorId: string,
): Promise<void> {
  if (principal.role === 'admin' || principal.role === 'ombudsman') return;
  const result = await model.findAssignment([principal.id, sectorId], client);
  if (!result.rowCount) throw forbidden();
}
