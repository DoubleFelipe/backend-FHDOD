import * as model from '../models/settings.js';
import type { Principal } from '../infrastructure/auth.js';
import type { SettingsInput } from '../validators/settings.js';
import { forbidden } from '../domain/errors.js';

export async function get(principal: Principal) {
  if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();
  return (await model.find()).rows[0] ?? { notification_emails: [], notifications_enabled: false };
}
export async function update(principal: Principal, input: SettingsInput) {
  if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();
  return (await model.save(input)).rows[0];
}
