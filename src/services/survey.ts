import { transaction, withClient } from '../utils/database.js';
import * as model from '../models/survey.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { badRequest, notFound } from '../domain/errors.js';
import { hashToken } from '../infrastructure/auth.js';
import { shiftFor } from '../domain/metrics.js';

import type { Submission, SurveyInput } from '../validators/survey.js';
import type { Principal } from '../infrastructure/auth.js';
import { forbidden } from '../domain/errors.js';
import { assertSectorAccess } from './access.js';
export async function getPublicSurvey(slug: string) {
  const result = await model.findPublic([slug]);
  if (!result.rowCount) throw notFound();
  const row = result.rows[0]!;
  return {
    title: row.title,
    tabletResetSeconds: row.tablet_reset_seconds,
    sector: { id: row.sector_id, name: row.sector_name },
    questions: row.questions,
  };
}
export async function submitResponse(slug: string, idempotencyKey: string, input: Submission) {
  return transaction(async (client) => {
    const survey = await model.lockPublished([slug], client);
    if (!survey.rowCount) throw notFound();
    const sectorId = survey.rows[0]!.sector_id as string;
    const surveyId = survey.rows[0]!.survey_id as string;
    const inserted = await model.reserveKey(
      [surveyId, idempotencyKey, hashToken(idempotencyKey)],
      client,
    );
    if (!inserted.rowCount) {
      const existing = await model.findKey([surveyId, idempotencyKey], client);
      if (existing.rows[0]?.response_id) {
        return { id: existing.rows[0]!.response_id, repeated: true };
      }
      throw new Error('Concurrent or expired idempotency key');
    }
    const questionIds = [...new Set(input.answers.map((answer) => answer.questionId))];
    if (questionIds.length !== input.answers.length) throw badRequest('Duplicate answer question');
    const required = await model.findRequiredQuestions([sectorId], client);
    if (required.rows.some((question) => !questionIds.includes(question.id as string)))
      throw badRequest('A required question is unanswered');
    if (questionIds.length) {
      const questions = await model.findApplicableQuestions([questionIds, sectorId], client);
      if (questions.rowCount !== questionIds.length)
        throw badRequest('Invalid question for this sector');
    }
    const lowRating = input.answers.some((answer) => answer.score < 3);
    if (input.complaint && !lowRating)
      throw badRequest('Complaints are only accepted for ratings below 3');
    if (input.complaint && input.complaint.contact && !input.complaint.consent)
      throw badRequest('Contact consent is required');
    const responseId = randomUUID();
    const attendedAt = input.attendedAt ? new Date(input.attendedAt) : null;
    const shift = shiftFor(attendedAt ?? new Date());
    await model.insertResponse([responseId, surveyId, input.npsScore, shift, attendedAt], client);
    for (const answer of input.answers)
      await model.insertAnswer(
        [responseId, answer.score, answer.questionId, answer.questionText],
        client,
      );
    if (input.complaint) {
      const complaint = await model.insertComplaint(
        [
          responseId,
          input.complaint.comment,
          input.complaint.contact ?? null,
          input.complaint.consent,
        ],
        client,
      );
      await model.insertNotification([complaint.rows[0]!.id], client);
    }
    await model.completeKey([surveyId, idempotencyKey, responseId], client);
    return { id: responseId, repeated: false };
  });
}
export type TxClient = PoolClient;

export async function list(principal: Principal) {
  if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();
  return (await model.list()).rows;
}

export async function archive(principal: Principal, surveyId: string) {
  if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();
  const result = await model.archive([surveyId]);
  if (!result.rowCount) throw notFound();
}

export async function publish(principal: Principal, input: SurveyInput) {
  if (principal.role === 'sector_manager') {
    await withClient(async (client) => {
      await assertSectorAccess(client, principal, input.sector_id);
    });
  } else if (!['admin', 'ombudsman'].includes(principal.role)) throw forbidden();
  const result = await model.publish([input.sector_id, input.title, input.tablet_reset_seconds]);
  return result.rows[0]!;
}
