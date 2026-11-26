import { z } from 'zod';
import { config } from '../config/index.js';
import { id } from './common.js';

export const responseSchema = z
  .object({
    attendedAt: z.string().datetime().optional(),
    npsScore: z.number().int().min(0).max(10),
    answers: z
      .array(
        z
          .object({
            questionId: id,
            score: z.number().int().min(1).max(5),
            questionText: z.string().max(300),
          })
          .strict(),
      )
      .max(config.PUBLIC_SUBMISSION_MAX_FIELDS),
    complaint: z
      .object({
        comment: z.string().max(2000).nullable().optional(),
        contact: z.string().max(30).optional(),
        consent: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const surveySchema = z
  .object({
    sector_id: id,
    title: z.string().trim().min(2).max(150),
    tablet_reset_seconds: z.number().int().min(10).max(120),
  })
  .strict();
export type SurveyInput = z.infer<typeof surveySchema>;
export type Submission = z.infer<typeof responseSchema>;
