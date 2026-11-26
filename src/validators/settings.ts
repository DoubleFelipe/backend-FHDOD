import { z } from 'zod';
export const settingsSchema = z
  .object({
    notification_emails: z.array(z.string().email()).max(20),
    notifications_enabled: z.boolean(),
  })
  .strict();
export type SettingsInput = z.infer<typeof settingsSchema>;
