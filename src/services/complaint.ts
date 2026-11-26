import { withClient } from '../utils/database.js';
import * as model from '../models/complaint.js';
import { type Principal } from '../infrastructure/auth.js';
import { forbidden, notFound } from '../domain/errors.js';
import { assertSectorAccess } from './access.js';
import { type ComplaintQuery, type ComplaintInput } from '../validators/complaint.js';
export async function list(principal: Principal, query: ComplaintQuery) {
  if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();

  return withClient(async (client) => {
    if (query.sectorId) await assertSectorAccess(client, principal, query.sectorId);
    const rows = await model.list(
      [
        ['admin', 'ombudsman'].includes(principal.role),
        principal.id,
        query.sectorId ?? null,
        query.status ?? null,
        query.limit,
        query.offset,
      ],
      client,
    );
    return { items: rows.rows, limit: query.limit, offset: query.offset };
  });
}

export async function update(principal: Principal, complaintId: string, input: ComplaintInput) {
  if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();

  return withClient(async (client) => {
    const result = await model.findOwner([complaintId], client);
    if (!result.rowCount) throw notFound();
    await assertSectorAccess(client, principal, result.rows[0]!.sector_id as string);
    const updated = await model.updateStatus([complaintId, input.status], client);
    return updated.rows[0]!;
  });
}
