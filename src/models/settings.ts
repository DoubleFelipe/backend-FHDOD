import { pool } from '../config/database.js';
import type { SettingsInput } from '../validators/settings.js';

export function find() {
  return pool.query<SettingsInput>(
    'SELECT notification_emails, notifications_enabled FROM app_settings WHERE id = true',
  );
}
export function save(input: SettingsInput) {
  return pool.query<SettingsInput>(
    'INSERT INTO app_settings (id, notification_emails, notifications_enabled) VALUES (true, $1, $2) ON CONFLICT (id) DO UPDATE SET notification_emails = EXCLUDED.notification_emails, notifications_enabled = EXCLUDED.notifications_enabled, updated_at = now() RETURNING notification_emails, notifications_enabled',
    [input.notification_emails, input.notifications_enabled],
  );
}
