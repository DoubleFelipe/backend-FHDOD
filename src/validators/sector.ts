import { z } from 'zod';
export const sectorSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(100),
  })
  .strict();
export type SectorInput = z.infer<typeof sectorSchema>;
