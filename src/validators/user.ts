import { z } from 'zod';
import { id } from './common.js';

export const userSchema = z
  .object({
    email: z.string().email().max(254),
    fullName: z.string().trim().min(2).max(150),
    role: z.enum(['admin', 'ombudsman', 'sector_manager']),
    temporaryPassword: z.string().min(12).max(200),
    sectorIds: z
      .array(id)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, 'Duplicate sector')
      .default([]),
  })
  .strict();
export type UserInput = z.infer<typeof userSchema>;
