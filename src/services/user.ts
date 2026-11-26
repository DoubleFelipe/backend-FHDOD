import { transaction } from '../utils/database.js';
import * as model from '../models/user.js';
import { hashPassword, type Principal } from '../infrastructure/auth.js';
import { AppError, forbidden } from '../domain/errors.js';
import { type UserInput } from '../validators/user.js';
export async function list(principal: Principal) {
  if (principal.role !== 'admin') throw forbidden();
  const result = await model.list();
  return result.rows;
}

export async function create(principal: Principal, input: UserInput) {
  if (principal.role !== 'admin') throw forbidden();

  if (
    (input.role === 'sector_manager' && input.sectorIds.length === 0) ||
    (input.role !== 'sector_manager' && input.sectorIds.length > 0)
  ) {
    throw new AppError(400, 'Invalid sector assignments', 'VALIDATION_ERROR');
  }
  return transaction(async (client) => {
    const profile = await model.insert(
      [
        input.email.toLowerCase(),
        input.fullName,
        await hashPassword(input.temporaryPassword),
        input.role,
      ],
      client,
    );
    if (input.sectorIds.length) {
      await model.assignSectors([profile.rows[0]!.id, input.sectorIds], client);
      const assigned = await model.countAssignments([profile.rows[0]!.id], client);
      if (assigned.rows[0]!.count !== input.sectorIds.length)
        throw new AppError(400, 'Invalid sector assignments', 'VALIDATION_ERROR');
    }
    return profile.rows[0]!;
  });
}
