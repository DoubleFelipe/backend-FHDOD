import { z } from 'zod';
import { id, paginationFields } from './common.js';
const status = z.enum(['open', 'in_progress', 'closed']);
export const complaintQuery = z
  .object({ sectorId: id.optional(), status: status.optional(), ...paginationFields })
  .strict();
export const complaintSchema = z.object({ status }).strict();
export type ComplaintQuery = z.infer<typeof complaintQuery>;
export type ComplaintInput = z.infer<typeof complaintSchema>;
