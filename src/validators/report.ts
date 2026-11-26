import { z } from 'zod';
import { paginationFields, periodFields, validPeriod } from './common.js';
export const metricsQuery = z
  .object(periodFields)
  .strict()
  .refine(validPeriod, 'Invalid date interval');
export const reportQuery = z
  .object({ ...periodFields, ...paginationFields })
  .strict()
  .refine(validPeriod, 'Invalid date interval');
export type MetricsQuery = z.infer<typeof metricsQuery>;
export type ReportQuery = z.infer<typeof reportQuery>;
