import { pool } from '../config/database.js';
import type { Database } from '../utils/database.js';
import type { ReportResponse } from './entities.js';

export function listResponses(
  values: [
    global: boolean,
    profileId: string,
    sectorId: string | null,
    from: string | null,
    to: string | null,
    shift: ReportResponse['shift'],
    limit: number,
    offset: number,
    includeComplaint: boolean,
  ],
  db: Database = pool,
) {
  return db.query<ReportResponse>(
    `SELECT r.id, sv.sector_id, s.name AS sector_name, r.nps, r.shift, r.attended_at, r.created_at,
        COALESCE((SELECT json_agg(json_build_object('questionId', a.question_id, 'questionText', a.question_text, 'score', a.value) ORDER BY a.id) FROM answers a WHERE a.response_id = r.id), '[]'::json) AS answers,
        CASE WHEN $9::boolean THEN (SELECT json_build_object('comment', c.comment, 'contact', c.contact, 'contactConsent', c.contact_consent, 'status', c.status) FROM complaints c WHERE c.response_id = r.id) ELSE NULL END AS complaint
        FROM responses r JOIN surveys sv ON sv.id = r.survey_id JOIN sectors s ON s.id = sv.sector_id
        WHERE ($1::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $2)) AND ($3::uuid IS NULL OR sv.sector_id = $3)
        AND ($4::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) >= $4) AND ($5::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) < $5)
        AND ($6::work_shift IS NULL OR r.shift = $6) ORDER BY r.created_at DESC LIMIT $7 OFFSET $8`,
    values,
  );
}
