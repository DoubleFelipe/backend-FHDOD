-- Dados ficticios para demonstracao do FHDOD.
-- Execute depois de aplicar database/migrations/001 e 002.
-- Seguro para reexecucao: IDs deterministas e conflitos ignorados.

BEGIN;

INSERT INTO sectors (id, name, slug)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Atendimento - Demonstração', 'demo-atendimento'),
  ('10000000-0000-4000-8000-000000000002', 'Serviços Digitais - Demonstração', 'demo-servicos-digitais')
ON CONFLICT (id) DO NOTHING;

INSERT INTO surveys (id, sector_id, title, status, published_at, tablet_reset_seconds)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Pesquisa de satisfação - Atendimento', 'published', now(), 20),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Pesquisa de satisfação - Serviços Digitais', 'published', now(), 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO questions (id, sector_id, text, kind, required, active, position)
VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Como você avalia a cordialidade da equipe?', 'rating', true, true, 1),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Como você avalia o tempo de espera?', 'rating', true, true, 2),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Como você avalia a clareza das informações?', 'rating', true, true, 3),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Como você avalia a facilidade de uso do serviço?', 'rating', true, true, 1),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Como você avalia a velocidade do atendimento?', 'rating', true, true, 2),
  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'Como você avalia as informações apresentadas?', 'rating', true, true, 3)
ON CONFLICT (id) DO NOTHING;

-- Trinta respostas por pesquisa, distribuídas pelos últimos 30 dias.
WITH survey_seed (survey_id) AS (
  VALUES
    ('20000000-0000-4000-8000-000000000001'::uuid),
    ('20000000-0000-4000-8000-000000000002'::uuid)
), generated AS (
  SELECT
    md5('fhdod-demo-response-' || s.survey_id::text || '-' || n.i)::uuid AS response_id,
    s.survey_id,
    n.i,
    CASE n.i % 3 WHEN 0 THEN 'morning'::work_shift WHEN 1 THEN 'afternoon'::work_shift ELSE 'night'::work_shift END AS shift,
    CASE n.i % 10
      WHEN 0 THEN 2 WHEN 1 THEN 4 WHEN 2 THEN 5 WHEN 3 THEN 6 WHEN 4 THEN 7
      WHEN 5 THEN 8 WHEN 6 THEN 9 WHEN 7 THEN 10 WHEN 8 THEN 8 ELSE 9
    END::smallint AS nps
  FROM survey_seed s
  CROSS JOIN generate_series(0, 29) AS n(i)
)
INSERT INTO responses (id, survey_id, nps, shift, attended_at, created_at)
SELECT response_id, survey_id, nps, shift,
       now() - ((29 - i) || ' days')::interval,
       now() - ((29 - i) || ' days')::interval
FROM generated
ON CONFLICT (id) DO NOTHING;

-- Três notas por resposta, ligadas às perguntas da pesquisa correspondente.
WITH survey_questions (survey_id, question_id, question_order) AS (
  VALUES
    ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001'::uuid, 1),
    ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000002'::uuid, 2),
    ('20000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000003'::uuid, 3),
    ('20000000-0000-4000-8000-000000000002'::uuid, '30000000-0000-4000-8000-000000000004'::uuid, 1),
    ('20000000-0000-4000-8000-000000000002'::uuid, '30000000-0000-4000-8000-000000000005'::uuid, 2),
    ('20000000-0000-4000-8000-000000000002'::uuid, '30000000-0000-4000-8000-000000000006'::uuid, 3)
), response_seed AS (
  SELECT
    md5('fhdod-demo-response-' || sv.id::text || '-' || n.i)::uuid AS response_id,
    sv.id AS survey_id,
    n.i,
    CASE n.i % 10
      WHEN 0 THEN 2 WHEN 1 THEN 4 WHEN 2 THEN 5 WHEN 3 THEN 6 WHEN 4 THEN 7
      WHEN 5 THEN 8 WHEN 6 THEN 9 WHEN 7 THEN 10 WHEN 8 THEN 8 ELSE 9
    END AS nps
  FROM surveys sv
  CROSS JOIN generate_series(0, 29) AS n(i)
  WHERE sv.id IN (
    '20000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid
  )
)
INSERT INTO answers (response_id, question_id, value, question_text)
SELECT
  r.response_id,
  q.question_id,
  greatest(1, least(5, (r.nps + 1) / 2 + ((r.i + q.question_order) % 3) - 1))::smallint,
  questions.text
FROM response_seed r
JOIN survey_questions q ON q.survey_id = r.survey_id
JOIN questions ON questions.id = q.question_id
ON CONFLICT (response_id, question_id) DO NOTHING;

-- Algumas respostas baixas recebem ocorrências fictícias, sem telefone ou e-mail.
WITH low_scores AS (
  SELECT r.id, r.nps,
         row_number() OVER (PARTITION BY r.survey_id ORDER BY r.id) AS item
  FROM responses r
  WHERE r.survey_id IN (
    '20000000-0000-4000-8000-000000000001'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid
  ) AND r.nps <= 5
)
INSERT INTO complaints (response_id, comment, contact, contact_consent, status)
SELECT id,
       CASE item % 3
         WHEN 0 THEN 'O tempo de espera foi maior do que o esperado.'
         WHEN 1 THEN 'Tive dificuldade para encontrar a informação de que precisava.'
         ELSE 'O atendimento poderia explicar melhor os próximos passos.'
       END,
       NULL,
       false,
       CASE item % 3 WHEN 0 THEN 'open'::complaint_status WHEN 1 THEN 'in_progress'::complaint_status ELSE 'closed'::complaint_status END
FROM low_scores
ON CONFLICT (response_id) DO NOTHING;

COMMIT;

-- Conferência rápida dos dados incluídos:
SELECT s.name AS setor, count(r.id) AS respostas,
       round(avg(r.nps), 1) AS nps_medio,
       count(c.response_id) AS ocorrencias
FROM sectors s
JOIN surveys sv ON sv.sector_id = s.id
LEFT JOIN responses r ON r.survey_id = sv.id
LEFT JOIN complaints c ON c.response_id = r.id
WHERE s.slug IN ('demo-atendimento', 'demo-servicos-digitais')
GROUP BY s.name
ORDER BY s.name;
