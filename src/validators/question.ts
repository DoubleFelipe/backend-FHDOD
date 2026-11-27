import { z } from 'zod';
import { id } from './common.js';
export const questionSchema = z
  .object({
    text: z.string().trim().min(3).max(300),
    position: z.number().int().min(0).max(1000),
    sector_id: id.nullable(),
  })
  .strict();
export const deactivateSchema = z.object({ active: z.literal(false) }).strict();
export type QuestionInput = z.infer<typeof questionSchema>;
