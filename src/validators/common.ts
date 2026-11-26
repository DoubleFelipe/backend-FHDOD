import { z } from 'zod';

export const id = z.string().uuid();
export const idParams = z.object({ id }).strict();
export const slugParams = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/),
  })
  .strict();
export const sectorQuery = z.object({ sectorId: id.optional() }).strict();
export const periodFields = {
  sectorId: id.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  shift: z.enum(['morning', 'afternoon', 'night']).optional(),
};
export const paginationFields = {
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
};
export const validPeriod = (value: { from?: string | undefined; to?: string | undefined }) =>
  !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to);
