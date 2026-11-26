import { withClient } from '../utils/database.js';
import * as model from '../models/question.js';
import { type Principal } from '../infrastructure/auth.js';
import { forbidden, notFound } from '../domain/errors.js';
import { assertSectorAccess } from './access.js';
import { type QuestionInput } from '../validators/question.js';
export async function list(principal: Principal) {
  const result = ['admin', 'ombudsman'].includes(principal.role)
    ? await model.listAll()
    : await model.listAssigned([principal.id]);
  return result.rows;
}

export async function create(principal: Principal, input: QuestionInput) {
  if (principal.role === 'sector_manager') {
    if (!input.sector_id) throw forbidden();
    const sectorId = input.sector_id;
    await withClient(async (client) => {
      await assertSectorAccess(client, principal, sectorId);
    });
  } else if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();
  const result = await model.insert([input.text, input.position, input.sector_id]);
  return result.rows[0]!;
}

export async function deactivate(principal: Principal, questionId: string) {
  if (principal.role === 'sector_manager') {
    const owner = await model.findOwner([questionId]);
    if (!owner.rowCount || !owner.rows[0]!.sector_id) throw forbidden();
    await withClient(async (client) => {
      await assertSectorAccess(client, principal, owner.rows[0]!.sector_id as string);
    });
  } else if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();
  const result = await model.deactivate([questionId, false]);
  if (!result.rowCount) throw notFound();
  return result.rows[0]!;
}
