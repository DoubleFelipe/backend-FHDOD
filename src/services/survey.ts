import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../infrastructure/database.js';
import { badRequest, notFound } from '../domain/errors.js';
import { shiftFor } from '../domain/metrics.js';
import { hashToken } from '../infrastructure/auth.js';

export type Submission = { npsScore: number; answers: { questionId: string; score: number; questionText: string }[]; complaint?: { comment?: string | null | undefined; contact?: string | undefined; consent: boolean } | undefined };
export async function getPublicSurvey(slug: string) {
  const result = await pool.query(`SELECT sv.id AS survey_id, sv.title, sv.tablet_reset_seconds, s.id AS sector_id, s.name AS sector_name,
      COALESCE(json_agg(json_build_object('id', q.id, 'text', q.text, 'kind', q.kind, 'required', q.required) ORDER BY q.position) FILTER (WHERE q.id IS NOT NULL), '[]') AS questions
    FROM surveys sv JOIN sectors s ON s.id = sv.sector_id
    LEFT JOIN questions q ON (q.sector_id = s.id OR q.sector_id IS NULL) AND q.active = true
    WHERE s.slug = $1 AND s.active = true AND sv.status = 'published'
    GROUP BY sv.id, s.id`, [slug]);
  if (!result.rowCount) throw notFound();
  const row = result.rows[0] as Record<string, unknown>;
  return { title: row.title, tabletResetSeconds: row.tablet_reset_seconds, sector: { id: row.sector_id, name: row.sector_name }, questions: row.questions };
}
export async function submitResponse(slug: string, idempotencyKey: string, input: Submission) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const survey = await client.query(`SELECT sv.id AS survey_id, s.id AS sector_id FROM surveys sv JOIN sectors s ON s.id = sv.sector_id
      WHERE s.slug = $1 AND s.active = true AND sv.status = 'published' FOR SHARE`, [slug]);
    if (!survey.rowCount) throw notFound();
    const sectorId = survey.rows[0].sector_id as string;
    const surveyId = survey.rows[0].survey_id as string;
    const inserted = await client.query('INSERT INTO submission_keys (survey_id, submission_id, session_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING submission_id', [surveyId, idempotencyKey, hashToken(idempotencyKey)]);
    if (!inserted.rowCount) {
      const existing = await client.query('SELECT response_id FROM submission_keys WHERE survey_id = $1 AND submission_id = $2', [surveyId, idempotencyKey]);
      if (existing.rows[0]?.response_id) { await client.query('COMMIT'); return { id: existing.rows[0].response_id, repeated: true }; }
      throw new Error('Concurrent or expired idempotency key');
    }
    const questionIds = [...new Set(input.answers.map((answer) => answer.questionId))];
    if (questionIds.length !== input.answers.length) throw badRequest('Duplicate answer question');
    const required = await client.query("SELECT id FROM questions WHERE active = true AND required = true AND kind = 'rating' AND (sector_id = $1 OR sector_id IS NULL)", [sectorId]);
    if (required.rows.some((question) => !questionIds.includes(question.id as string))) throw badRequest('A required question is unanswered');
    if (questionIds.length) {
      const questions = await client.query("SELECT id FROM questions WHERE id = ANY($1::uuid[]) AND active = true AND kind = 'rating' AND (sector_id = $2 OR sector_id IS NULL)", [questionIds, sectorId]);
      if (questions.rowCount !== questionIds.length) throw badRequest('Invalid question for this sector');
    }
    if (input.complaint && input.complaint.contact && !input.complaint.consent) throw badRequest('Contact consent is required');
    const responseId = randomUUID();
    const shift = shiftFor(new Date());
    await client.query('INSERT INTO responses (id, survey_id, nps, shift) VALUES ($1, $2, $3, $4)', [responseId, surveyId, input.npsScore, shift]);
    for (const answer of input.answers) await client.query('INSERT INTO answers (response_id, question_id, value, question_text) SELECT $1, id, $2, $4 FROM questions WHERE id = $3', [responseId, answer.score, answer.questionId, answer.questionText]);
    if (input.complaint) {
      const complaint = await client.query('INSERT INTO complaints (response_id, comment, contact, contact_consent) VALUES ($1, $2, $3, $4) RETURNING id', [responseId, input.complaint.comment, input.complaint.contact ?? null, input.complaint.consent]);
      await client.query('INSERT INTO notification_jobs (complaint_id) VALUES ($1)', [complaint.rows[0].id]);
    }
    await client.query('UPDATE submission_keys SET response_id = $3 WHERE survey_id = $1 AND submission_id = $2', [surveyId, idempotencyKey, responseId]);
    await client.query('COMMIT');
    return { id: responseId, repeated: false };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export type TxClient = PoolClient;
