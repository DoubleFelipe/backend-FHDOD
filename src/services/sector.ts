import { withClient } from '../utils/database.js';
import * as model from '../models/sector.js';
import { type Principal } from '../infrastructure/auth.js';
import { forbidden } from '../domain/errors.js';
import { assertSectorAccess } from './access.js';
import { type SectorInput } from '../validators/sector.js';
export async function list(principal: Principal, sectorId?: string) {
  return withClient(async (client) => {
    if (sectorId) await assertSectorAccess(client, principal, sectorId);
    const result = ['admin', 'ombudsman'].includes(principal.role)
      ? await model.listAll(client)
      : await model.listAssigned([principal.id], client);
    return sectorId ? result.rows.filter((row) => row.id === sectorId) : result.rows;
  });
}

export async function publicSectors() {
  const result = await model.listPublic();
  return result.rows;
}

export async function create(principal: Principal, input: SectorInput) {
  if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();

  const result = await model.insert([input.name, input.slug]);
  return result.rows[0]!;
}
