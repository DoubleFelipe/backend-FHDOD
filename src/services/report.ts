import { withClient } from '../utils/database.js';
import * as model from '../models/report.js';
import { type Principal } from '../infrastructure/auth.js';
import { forbidden } from '../domain/errors.js';
import { assertSectorAccess } from './access.js';
import { type ReportQuery } from '../validators/report.js';
export async function responses(principal: Principal, query: ReportQuery) {
  if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();

  return withClient(async (client) => {
    if (query.sectorId) await assertSectorAccess(client, principal, query.sectorId);
    const privileged = ['admin', 'ombudsman'].includes(principal.role);
    const result = await model.listResponses(
      [
        privileged,
        principal.id,
        query.sectorId ?? null,
        query.from ?? null,
        query.to ?? null,
        query.shift ?? null,
        query.limit,
        query.offset,
        privileged,
      ],
      client,
    );
    return { items: result.rows, limit: query.limit, offset: query.offset };
  });
}
