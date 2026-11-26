import { pool } from '../config/database.js';
import type { Database } from '../utils/database.js';
import type {
  PublicSurveyRow,
  SurveyResponse,
  Answer,
  NotificationJob,
  SubmissionKey,
  Survey,
} from './entities.js';

export function findPublic(values: [slug: string], db: Database = pool) {
  return db.query<PublicSurveyRow>(
    `SELECT sv.id AS survey_id, sv.title, sv.tablet_reset_seconds, s.id AS sector_id, s.name AS sector_name,
      COALESCE(json_agg(json_build_object('id', q.id, 'text', q.text, 'kind', q.kind, 'required', q.required, 'sectorId', q.sector_id) ORDER BY q.position) FILTER (WHERE q.id IS NOT NULL), '[]') AS questions
    FROM surveys sv JOIN sectors s ON s.id = sv.sector_id
    LEFT JOIN questions q ON (q.sector_id = s.id OR q.sector_id IS NULL) AND q.active = true
    WHERE s.slug = $1 AND s.active = true AND sv.status = 'published'
    GROUP BY sv.id, s.id`,
    values,
  );
}

export function lockPublished(values: [slug: string], db: Database = pool) {
  return db.query<{ survey_id: string; sector_id: string }>(
    `SELECT sv.id AS survey_id, s.id AS sector_id FROM surveys sv JOIN sectors s ON s.id = sv.sector_id
      WHERE s.slug = $1 AND s.active = true AND sv.status = 'published' FOR SHARE`,
    values,
  );
}

export function reserveKey(
  values: [surveyId: string, submissionId: string, hash: string],
  db: Database = pool,
) {
  return db.query<{ submission_id: string }>(
    'INSERT INTO submission_keys (survey_id, submission_id, session_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING submission_id',
    values,
  );
}

export function findKey(values: [surveyId: string, submissionId: string], db: Database = pool) {
  return db.query<{ response_id: string | null }>(
    'SELECT response_id FROM submission_keys WHERE survey_id = $1 AND submission_id = $2',
    values,
  );
}

export function findRequiredQuestions(values: [sectorId: string], db: Database = pool) {
  return db.query<{ id: string }>(
    "SELECT id FROM questions WHERE active = true AND required = true AND kind = 'rating' AND (sector_id = $1 OR sector_id IS NULL)",
    values,
  );
}

export function findApplicableQuestions(
  values: [questionIds: string[], sectorId: string],
  db: Database = pool,
) {
  return db.query<{ id: string }>(
    "SELECT id FROM questions WHERE id = ANY($1::uuid[]) AND active = true AND kind = 'rating' AND (sector_id = $2 OR sector_id IS NULL)",
    values,
  );
}

export function insertResponse(
  values: [
    id: string,
    surveyId: string,
    nps: number,
    shift: SurveyResponse['shift'],
    attendedAt: Date | null,
  ],
  db: Database = pool,
) {
  return db.query<SurveyResponse>(
    'INSERT INTO responses (id, survey_id, nps, shift, attended_at) VALUES ($1, $2, $3, $4, $5)',
    values,
  );
}

export function insertAnswer(
  values: [responseId: string, score: number, questionId: string, text: string],
  db: Database = pool,
) {
  return db.query<Answer>(
    'INSERT INTO answers (response_id, question_id, value, question_text) SELECT $1, id, $2, $4 FROM questions WHERE id = $3',
    values,
  );
}

export function insertComplaint(
  values: [
    responseId: string,
    comment: string | null | undefined,
    contact: string | null,
    consent: boolean,
  ],
  db: Database = pool,
) {
  return db.query<{ id: string }>(
    'INSERT INTO complaints (response_id, comment, contact, contact_consent) VALUES ($1, $2, $3, $4) RETURNING id',
    values,
  );
}

export function insertNotification(values: [complaintId: string], db: Database = pool) {
  return db.query<NotificationJob>(
    'INSERT INTO notification_jobs (complaint_id) VALUES ($1)',
    values,
  );
}

export function completeKey(
  values: [surveyId: string, submissionId: string, responseId: string],
  db: Database = pool,
) {
  return db.query<SubmissionKey>(
    'UPDATE submission_keys SET response_id = $3 WHERE survey_id = $1 AND submission_id = $2',
    values,
  );
}

export function publish(
  values: [sectorId: string, title: string, resetSeconds: number],
  db: Database = pool,
) {
  return db.query<Survey>(
    "INSERT INTO surveys (sector_id, title, tablet_reset_seconds, status, published_at) VALUES ($1, $2, $3, 'published', now()) RETURNING id, sector_id, title, status, tablet_reset_seconds",
    values,
  );
}
