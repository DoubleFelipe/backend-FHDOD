import { z } from 'zod';

export const loginSchema = z
  .object({ email: z.string().email().max(254), password: z.string().min(1).max(200) })
  .strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(4096) }).strict();
export const passwordSchema = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200) })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
