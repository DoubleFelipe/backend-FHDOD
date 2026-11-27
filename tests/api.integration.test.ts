import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance, HTTPMethods } from 'fastify';

vi.mock('../src/config/database.js', async () => ({
  pool: (await import('./helpers/database.js')).testPool,
}));

import { buildApp } from '../src/app.js';
import { hashPassword, issueTokens } from '../src/infrastructure/auth.js';
import type { UserRole } from '../src/models/entities.js';
import { database, migrate, testPool } from './helpers/database.js';
import * as surveyModel from '../src/models/survey.js';
import * as authModel from '../src/models/auth.js';

const sectorA = randomUUID(),
  sectorB = randomUUID(),
  unpublishedSector = randomUUID();
const questionA = randomUUID(),
  questionB = randomUUID(),
  globalQuestion = randomUUID();
const profileIds = {
  admin: randomUUID(),
  ombudsman: randomUUID(),
  sector_manager: randomUUID(),
  temporary: randomUUID(),
};
const password = 'Fixture-only-password-2026';
const access: Record<string, string> = {};
let app: FastifyInstance;
const exercised = new Set<string>();
const registered = new Set<string>();

async function call(
  method: HTTPMethods,
  path: string,
  role?: string,
  payload?: object,
  headers: Record<string, string> = {},
) {
  exercised.add(`${method} ${path.split('?')[0]}`);
  return app.inject({
    method,
    url: `/api/v1${path}`,
    ...(payload ? { payload } : {}),
    headers: { ...(role ? { authorization: `Bearer ${access[role]}` } : {}), ...headers },
  });
}
function submission(score = 2, questionId = questionA) {
  return {
    attendedAt: '2026-11-26T12:00:00Z',
    npsScore: 8,
    answers: [{ questionId, score, questionText: 'Como foi o atendimento?' }],
  };
}
async function submit(body: object, slug = 'sector-a', key = randomUUID()) {
  return call('POST', `/surveys/public/${slug}/responses`, undefined, body, {
    'idempotency-key': key,
  });
}
async function count(table: string) {
  // Only fixed table names supplied by these tests, never request data.
  return Number(
    (await database.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`))
      .rows[0]!.count,
  );
}

beforeAll(async () => {
  await migrate();
  const hash = await hashPassword(password);
  for (const [role, id] of Object.entries(profileIds)) {
    const temporary = role === 'temporary';
    const actualRole = (temporary ? 'admin' : role) as UserRole;
    await database.query(
      'INSERT INTO profiles (id, email, full_name, password_hash, role, must_change_password) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, `${role}@example.test`, role, hash, actualRole, temporary],
    );
    access[role] = (
      await issueTokens({ id, role: actualRole, mustChangePassword: temporary })
    ).accessToken;
  }
  for (const [id, name, slug] of [
    [sectorA, 'Setor A', 'sector-a'],
    [sectorB, 'Setor B', 'sector-b'],
    [unpublishedSector, 'Sem pesquisa', 'unpublished'],
  ]) {
    await database.query('INSERT INTO sectors (id, name, slug) VALUES ($1, $2, $3)', [
      id,
      name,
      slug,
    ]);
  }
  await database.query('INSERT INTO sector_managers (profile_id, sector_id) VALUES ($1, $2)', [
    profileIds.sector_manager,
    sectorA,
  ]);
  for (const sector of [sectorA, sectorB])
    await database.query(
      "INSERT INTO surveys (sector_id, title, status) VALUES ($1, 'Pesquisa', 'published')",
      [sector],
    );
  for (const [id, sector, required] of [
    [questionA, sectorA, true],
    [questionB, sectorB, false],
    [globalQuestion, null, false],
  ]) {
    await database.query(
      "INSERT INTO questions (id, sector_id, text, kind, required) VALUES ($1, $2, 'Como foi o atendimento?', 'rating', $3)",
      [id, sector, required],
    );
  }
  app = buildApp();
  app.addHook('onRoute', (route) => {
    for (const method of Array.isArray(route.method) ? route.method : [route.method]) {
      if (route.url.startsWith('/api/v1/') && method !== 'HEAD')
        registered.add(`${method} ${route.url}`);
    }
  });
  await app.ready();
});
afterAll(async () => {
  await app?.close();
  await database.close();
});

describe('API with isolated PostgreSQL', () => {
  it('applies both migrations, including ombudsman, appointment time and integrity constraints', async () => {
    expect(await count('profiles')).toBe(4);
    const row = await database.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'responses' AND column_name = 'attended_at'",
    );
    expect(row.rows).toHaveLength(1);
    await expect(
      database.query('INSERT INTO responses (survey_id, nps) SELECT id, 11 FROM surveys LIMIT 1'),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('serves liveness and readiness', async () => {
    expect((await call('GET', '/health/live')).json()).toEqual({ status: 'ok' });
    expect((await call('GET', '/health/ready')).json()).toEqual({ status: 'ready' });
    testPool.query.mockRejectedValueOnce(new Error('private connection details'));
    expect((await call('GET', '/health/ready')).statusCode).toBe(503);
  });
  it('logs in using Argon2, exposes a safe profile and rejects wrong passwords', async () => {
    const result = await call('POST', '/auth/login', undefined, {
      email: 'ADMIN@example.test',
      password,
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ tokenType: 'Bearer', mustChangePassword: false });
    const me = await call('GET', '/auth/me', 'admin');
    expect(me.json()).toMatchObject({ id: profileIds.admin, role: 'admin' });
    expect(me.body).not.toContain('password_hash');
    expect(
      (
        await call('POST', '/auth/login', undefined, {
          email: 'admin@example.test',
          password: 'wrong',
        })
      ).statusCode,
    ).toBe(401);
  });
  it('rotates refresh tokens once, rejects reuse and revokes on logout', async () => {
    const login = await call('POST', '/auth/login', undefined, {
      email: 'admin@example.test',
      password,
    });
    const refreshToken = login.json().refreshToken;
    const rotated = await call('POST', '/auth/refresh', undefined, { refreshToken });
    expect(rotated.statusCode).toBe(200);
    expect(rotated.json().refreshToken).not.toBe(refreshToken);
    expect((await call('POST', '/auth/refresh', undefined, { refreshToken })).statusCode).toBe(401);
    expect(
      (await call('POST', '/auth/logout', undefined, { refreshToken: rotated.json().refreshToken }))
        .statusCode,
    ).toBe(204);
    expect(
      (
        await call('POST', '/auth/refresh', undefined, {
          refreshToken: rotated.json().refreshToken,
        })
      ).statusCode,
    ).toBe(401);
  });
  it('blocks temporary passwords then accepts the same access token after a password change', async () => {
    expect((await call('GET', '/users', 'temporary')).statusCode).toBe(403);
    expect(
      (
        await call('PATCH', '/auth/password', 'temporary', {
          currentPassword: 'wrong',
          newPassword: password + '-new',
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await call('PATCH', '/auth/password', 'temporary', {
          currentPassword: password,
          newPassword: password + '-new',
        })
      ).statusCode,
    ).toBe(204);
    expect((await call('GET', '/users', 'temporary')).statusCode).toBe(200);
  });
  it('checks active state and current role instead of trusting stale claims', async () => {
    await database.query('UPDATE profiles SET active = false WHERE id = $1', [
      profileIds.ombudsman,
    ]);
    expect((await call('GET', '/auth/me', 'ombudsman')).statusCode).toBe(401);
    await database.query('UPDATE profiles SET active = true WHERE id = $1', [profileIds.ombudsman]);
    await database.query("UPDATE profiles SET role = 'sector_manager' WHERE id = $1", [
      profileIds.admin,
    ]);
    expect((await call('GET', '/users', 'admin')).statusCode).toBe(403);
    await database.query("UPDATE profiles SET role = 'admin' WHERE id = $1", [profileIds.admin]);
    await database.query('UPDATE profiles SET must_change_password = true WHERE id = $1', [
      profileIds.admin,
    ]);
    expect((await call('GET', '/users', 'admin')).statusCode).toBe(403);
    await database.query('UPDATE profiles SET must_change_password = false WHERE id = $1', [
      profileIds.admin,
    ]);
  });
  it('keeps the original refresh session usable if rotation fails before commit', async () => {
    const login = await call('POST', '/auth/login', undefined, {
      email: 'admin@example.test',
      password,
    });
    const refreshToken = login.json().refreshToken;
    const insert = vi
      .spyOn(authModel, 'createSession')
      .mockRejectedValueOnce(new Error('storage failure'));
    try {
      expect((await call('POST', '/auth/refresh', undefined, { refreshToken })).statusCode).toBe(
        500,
      );
      expect((await call('POST', '/auth/refresh', undefined, { refreshToken })).statusCode).toBe(
        200,
      );
    } finally {
      insert.mockRestore();
    }
  });
  it('lists accounts without hashes and provisions managers atomically', async () => {
    expect((await call('GET', '/users', 'ombudsman')).statusCode).toBe(403);
    const input = {
      email: 'new-manager@example.test',
      fullName: 'Nova gestora',
      role: 'sector_manager',
      temporaryPassword: password,
      sectorIds: [sectorA],
    };
    const created = await call('POST', '/users', 'admin', input);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ mustChangePassword: true, email: input.email });
    expect(created.body).not.toContain('password_hash');
    const before = await count('profiles');
    expect(
      (
        await call('POST', '/users', 'admin', {
          ...input,
          email: 'invalid@example.test',
          sectorIds: [randomUUID()],
        })
      ).statusCode,
    ).toBe(400);
    expect(await count('profiles')).toBe(before);
    expect((await call('POST', '/users', 'admin', input)).statusCode).toBe(409);
    expect(
      (
        await call('POST', '/users', 'admin', {
          ...input,
          email: 'duplicate@example.test',
          sectorIds: [sectorA, sectorA],
        })
      ).statusCode,
    ).toBe(400);
  });
  it('returns only published public sectors and the appropriate survey questions', async () => {
    const sectors = (await call('GET', '/sectors/public')).json();
    expect(sectors).toHaveLength(2);
    const result = (await call('GET', '/surveys/public/sector-a')).json();
    expect(result).toMatchObject({ sector: { id: sectorA }, tabletResetSeconds: 20 });
    expect(result.questions.map((q: { id: string }) => q.id)).toEqual(
      expect.arrayContaining([questionA, globalQuestion]),
    );
    expect(result.questions.map((q: { id: string }) => q.id)).not.toContain(questionB);
    expect((await call('GET', '/surveys/public/unknown')).statusCode).toBe(404);
    expect((await call('GET', '/surveys/public/INVALID')).statusCode).toBe(400);
  });
  it('stores responses, historical text, complaints and notification jobs exactly once', async () => {
    const body = {
      ...submission(),
      complaint: { comment: 'Demora no atendimento', contact: '11900000000', consent: true },
    };
    const key = randomUUID();
    const first = await submit(body, 'sector-a', key);
    expect(first.statusCode).toBe(201);
    const repeat = await submit(body, 'sector-a', key);
    expect(repeat.statusCode).toBe(200);
    expect(repeat.json()).toEqual({ id: first.json().id, repeated: true });
    expect(await count('responses')).toBe(1);
    expect(await count('answers')).toBe(1);
    expect(await count('complaints')).toBe(1);
    expect(await count('notification_jobs')).toBe(1);
    const saved = await database.query('SELECT shift, attended_at FROM responses WHERE id = $1', [
      first.json().id,
    ]);
    expect(saved.rows[0]).toMatchObject({
      shift: 'morning',
      attended_at: new Date(body.attendedAt),
    });
    const answer = await database.query(
      'SELECT question_text FROM answers WHERE response_id = $1',
      [first.json().id],
    );
    expect(answer.rows[0]).toMatchObject({ question_text: body.answers[0]!.questionText });
    expect(
      (await submit({ ...submission(5, questionB), npsScore: 2 }, 'sector-b', key)).statusCode,
    ).toBe(201);
  });
  it('rolls back invalid questions, missing required answers, duplicates and unconsented contact', async () => {
    const before = await count('submission_keys');
    for (const body of [
      submission(2, questionB),
      { ...submission(), answers: [] },
      { ...submission(), answers: [...submission().answers, ...submission().answers] },
      { ...submission(), complaint: { contact: '11900000000', consent: false } },
      { ...submission(5), complaint: { comment: 'Invalid condition', consent: false } },
    ]) {
      expect((await submit(body)).statusCode).toBe(400);
    }
    expect(await count('submission_keys')).toBe(before);
    expect((await submit({ npsScore: 11, answers: [] })).statusCode).toBe(400);
  });
  it('accepts omitted appointment time and calculates a submission-time shift', async () => {
    const result = await submit({ npsScore: 9, answers: [] }, 'sector-b');
    expect(result.statusCode).toBe(201);
    const row = (
      await database.query<{ attended_at: Date | null; shift: string }>(
        'SELECT attended_at, shift FROM responses WHERE id = $1',
        [result.json().id],
      )
    ).rows[0]!;
    expect(row.attended_at).toBeNull();
    expect(['morning', 'afternoon', 'night']).toContain(row.shift);
  });
  it('rolls back response, answers, complaint and key if notification persistence fails', async () => {
    const tables = ['responses', 'answers', 'complaints', 'submission_keys', 'notification_jobs'];
    const before = await Promise.all(tables.map(count));
    const job = vi
      .spyOn(surveyModel, 'insertNotification')
      .mockRejectedValueOnce(new Error('job storage unavailable'));
    try {
      expect(
        (
          await submit({
            ...submission(),
            complaint: { comment: 'Teste de rollback', consent: false },
          })
        ).statusCode,
      ).toBe(500);
      expect(await Promise.all(tables.map(count))).toEqual(before);
    } finally {
      job.mockRestore();
    }
  });
  it('scopes sector listing and creation permissions', async () => {
    expect(
      (await call('GET', '/sectors', 'sector_manager')).json().map((s: { id: string }) => s.id),
    ).toEqual([sectorA]);
    expect((await call('GET', `/sectors?sectorId=${sectorB}`, 'sector_manager')).statusCode).toBe(
      403,
    );
    expect(
      (await call('POST', '/sectors', 'sector_manager', { name: 'Novo setor', slug: 'new-sector' }))
        .statusCode,
    ).toBe(403);
    expect(
      (await call('POST', '/sectors', 'ombudsman', { name: 'Novo setor', slug: 'new-sector' }))
        .statusCode,
    ).toBe(201);
    expect(
      (await call('POST', '/sectors', 'admin', { name: 'Novo setor', slug: 'new-sector' }))
        .statusCode,
    ).toBe(409);
  });
  it('preserves manager publishing rights and one published survey per sector', async () => {
    const input = {
      sector_id: unpublishedSector,
      title: 'Pesquisa nova',
      tablet_reset_seconds: 30,
    };
    expect((await call('POST', '/surveys', 'sector_manager', input)).statusCode).toBe(403);
    expect((await call('POST', '/surveys', 'ombudsman', input)).statusCode).toBe(201);
    expect(
      (await call('POST', '/surveys', 'sector_manager', { ...input, sector_id: sectorA }))
        .statusCode,
    ).toBe(409);
    expect(
      (await call('POST', '/surveys', 'admin', { ...input, sector_id: randomUUID() })).statusCode,
    ).toBe(400);
  });
  it('scopes question management, preserves global questions and deactivates without deleting', async () => {
    const list = (await call('GET', '/questions', 'sector_manager')).json();
    expect(list.map((q: { id: string }) => q.id)).not.toContain(questionB);
    const input = { text: 'Nova pergunta?', position: 10, sector_id: sectorA };
    expect(
      (await call('POST', '/questions', 'sector_manager', { ...input, sector_id: null }))
        .statusCode,
    ).toBe(403);
    expect(
      (await call('POST', '/questions', 'sector_manager', { ...input, sector_id: sectorB }))
        .statusCode,
    ).toBe(403);
    const created = await call('POST', '/questions', 'sector_manager', input);
    expect(created.statusCode).toBe(201);
    expect(
      (await call('PATCH', `/questions/${globalQuestion}`, 'sector_manager', { active: false }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await call('PATCH', `/questions/${created.json().id}`, 'sector_manager', { active: false })
      ).json(),
    ).toMatchObject({ active: false });
    expect(
      (await call('PATCH', `/questions/${randomUUID()}`, 'admin', { active: false })).statusCode,
    ).toBe(404);
    expect(
      (await database.query('SELECT id FROM questions WHERE id = $1', [created.json().id])).rows,
    ).toHaveLength(1);
  });
  it('reads and replaces notification settings for privileged roles only', async () => {
    expect((await call('GET', '/settings/notifications', 'admin')).json()).toEqual({
      notification_emails: [],
      notifications_enabled: false,
    });
    const input = { notification_emails: ['ombudsman@example.test'], notifications_enabled: true };
    expect((await call('PUT', '/settings/notifications', 'ombudsman', input)).json()).toEqual(
      input,
    );
    expect((await call('GET', '/settings/notifications', 'sector_manager')).statusCode).toBe(403);
  });
  it('returns scoped metrics and filters appointment date and shift', async () => {
    const metrics = await call('GET', '/dashboard/metrics', 'sector_manager');
    expect(metrics.json()).toMatchObject({ total: 1, nps: 0, average: 2, ratings: 1 });
    expect(metrics.json().sectors).toEqual([expect.objectContaining({ id: sectorA })]);
    expect(
      (await call('GET', `/dashboard/metrics?sectorId=${sectorB}`, 'sector_manager')).statusCode,
    ).toBe(403);
    const filter = `sectorId=${sectorA}&from=2026-11-26T12:00:00Z&to=2026-11-26T13:00:00Z&shift=morning`;
    expect((await call('GET', `/dashboard/metrics?${filter}`, 'admin')).json().total).toBe(1);
    expect(
      (
        await call('GET', `/dashboard/metrics?sectorId=${sectorA}&to=2026-11-26T12:00:00Z`, 'admin')
      ).json().total,
    ).toBe(0);
  });
  it('keeps public TV metrics free of individual data', async () => {
    const metrics = await call('GET', '/tv/metrics');
    expect(metrics.statusCode).toBe(200);
    expect(metrics.json()).toMatchObject({ total: 3, sectors: [] });
    for (const privateField of ['contact', 'comment', 'response_id', 'password'])
      expect(metrics.body).not.toContain(privateField);
  });
  it('lists complaints, updates status and limits personal data to authorized roles', async () => {
    expect((await call('GET', '/complaints', 'sector_manager')).statusCode).toBe(403);
    const complaints = await call(
      'GET',
      `/complaints?sectorId=${sectorA}&status=open&limit=1`,
      'ombudsman',
    );
    expect(complaints.json().items).toHaveLength(1);
    const id = complaints.json().items[0].id;
    expect(
      (await call('PATCH', `/complaints/${id}`, 'ombudsman', { status: 'in_progress' })).json(),
    ).toMatchObject({ id, status: 'in_progress' });
    expect(
      (await call('PATCH', `/complaints/${id}`, 'sector_manager', { status: 'closed' })).statusCode,
    ).toBe(403);
    expect(
      (await call('PATCH', `/complaints/${randomUUID()}`, 'admin', { status: 'closed' }))
        .statusCode,
    ).toBe(404);
  });
  it('returns paginated reports with historical answers and complaint details only to privileged roles', async () => {
    expect((await call('GET', '/reports/responses', 'sector_manager')).statusCode).toBe(403);
    const report = await call('GET', `/reports/responses?sectorId=${sectorA}&limit=1`, 'admin');
    expect(report.statusCode).toBe(200);
    expect(report.json()).toMatchObject({
      limit: 1,
      offset: 0,
      items: [
        expect.objectContaining({
          answers: [expect.objectContaining({ score: 2 })],
          complaint: expect.objectContaining({ status: 'in_progress' }),
        }),
      ],
    });
    expect(
      (await call('GET', '/reports/responses?limit=1&offset=100', 'ombudsman')).json().items,
    ).toEqual([]);
  });
  it('validates pagination, intervals, UUIDs, unexpected fields and SQL injection payloads', async () => {
    for (const path of [
      '/reports/responses?limit=101',
      '/reports/responses?offset=-1',
      '/dashboard/metrics?from=2026-11-27T00:00:00Z&to=2026-11-26T00:00:00Z',
      '/sectors?sectorId=invalid',
      '/complaints?status=invalid',
      '/questions?unused=1',
    ]) {
      const response = await call('GET', path, 'admin');
      // Questions has no filter contract, so unknown query parameters are ignored as before.
      expect(response.statusCode).toBe(path.startsWith('/questions') ? 200 : 400);
    }
    expect(
      (
        await call('POST', '/auth/login', undefined, {
          email: "' OR true --@example.test",
          password,
        })
      ).statusCode,
    ).toBe(400);
    const name = "Injected'); DROP TABLE profiles; --";
    expect(
      (await call('POST', '/sectors', 'admin', { name, slug: 'injection-test' })).statusCode,
    ).toBe(201);
    expect(
      (await database.query('SELECT name FROM sectors WHERE slug = $1', ['injection-test']))
        .rows[0],
    ).toEqual({ name });
    expect(
      (
        await call('POST', '/auth/login', undefined, {
          email: 'admin@example.test',
          password,
          role: 'admin',
        })
      ).statusCode,
    ).toBe(400);
    expect(await count('profiles')).toBeGreaterThan(0);
  });
  it('archives surveys while preserving history and allowing a new publication', async () => {
    const sector = (
      await call('POST', '/sectors', 'admin', { name: 'Arquivo', slug: 'archive-test' })
    ).json();
    const question = (
      await call('POST', '/questions', 'admin', {
        text: 'Como foi?',
        position: 0,
        sector_id: sector.id,
      })
    ).json();
    const publication = {
      sector_id: sector.id,
      title: 'Pesquisa para arquivar',
      tablet_reset_seconds: 30,
    };
    const published = await call('POST', '/surveys', 'admin', publication);
    expect(published.statusCode).toBe(201);
    const survey = published.json();
    expect((await call('POST', '/surveys', 'admin', publication)).statusCode).toBe(409);
    const response = await submit(
      {
        ...submission(2, question.id),
        complaint: { comment: 'Comentário histórico', consent: false },
      },
      'archive-test',
    );
    expect(response.statusCode).toBe(201);
    const reportUrl = `/reports/responses?sectorId=${sector.id}`;
    const metricsUrl = `/dashboard/metrics?sectorId=${sector.id}`;
    const reportBefore = (await call('GET', reportUrl, 'admin')).json();
    const metricsBefore = (await call('GET', metricsUrl, 'admin')).json();
    expect(reportBefore.items).toHaveLength(1);
    expect(reportBefore.items[0]).toMatchObject({
      id: response.json().id,
      answers: [expect.objectContaining({ score: 2 })],
      complaint: expect.objectContaining({ comment: 'Comentário histórico' }),
    });
    const listed = await call('GET', '/surveys', 'ombudsman');
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toContainEqual({
      id: survey.id,
      title: survey.title,
      status: 'published',
      sector_id: sector.id,
      sector_name: 'Arquivo',
      sector_slug: 'archive-test',
    });
    expect((await call('DELETE', `/surveys/${survey.id}`, 'ombudsman')).statusCode).toBe(204);
    expect((await call('DELETE', `/surveys/${survey.id}`, 'admin')).statusCode).toBe(204);
    expect((await call('GET', '/surveys', 'admin')).json()).not.toContainEqual(
      expect.objectContaining({ id: survey.id }),
    );
    expect((await call('GET', '/surveys/public/archive-test')).statusCode).toBe(404);
    expect((await call('GET', '/sectors/public')).json()).not.toContainEqual(
      expect.objectContaining({ id: sector.id }),
    );
    expect((await submit(submission(2, question.id), 'archive-test')).statusCode).toBe(404);
    expect((await call('GET', reportUrl, 'admin')).json()).toEqual(reportBefore);
    expect((await call('GET', metricsUrl, 'admin')).json()).toEqual(metricsBefore);
    const replacement = await call('POST', '/surveys', 'admin', publication);
    expect(replacement.statusCode).toBe(201);
    expect(replacement.json().id).not.toBe(survey.id);
    expect((await call('GET', '/surveys/public/archive-test')).statusCode).toBe(200);
    expect(
      (await database.query('SELECT status FROM surveys WHERE id = $1', [survey.id])).rows[0],
    ).toEqual({ status: 'archived' });
  });
  it('returns consistent errors without SQL or credential details', async () => {
    testPool.query.mockRejectedValueOnce(new Error('private password connection detail'));
    const response = await call('GET', '/sectors/public');
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: expect.any(String),
      },
    });
    expect(response.body).not.toContain('private');
    expect((await call('GET', '/unknown')).json().error.code).toBe('NOT_FOUND');
  });
  it('exercises every documented HTTP operation', async () => {
    const spec = (await app.inject('/api/docs/json')).json();
    const documented = new Set<string>();
    for (const [path, operations] of Object.entries(
      spec.paths as Record<string, Record<string, unknown>>,
    )) {
      const normalized = path.replace('/api/v1', '');
      const pattern = new RegExp(`^${normalized.replace(/\{[^}]+\}/g, '[^/]+')}$`);
      for (const method of Object.keys(operations)) {
        documented.add(`${method.toUpperCase()} ${path.replace(/\{([^}]+)\}/g, ':$1')}`);
        expect(
          [...exercised].some(
            (item) =>
              item.startsWith(method.toUpperCase() + ' ') &&
              pattern.test(item.slice(method.length + 1)),
          ),
          `${method.toUpperCase()} ${path}`,
        ).toBe(true);
      }
    }
    expect(documented).toEqual(registered);
    expect(documented.size).toBe(27);
  });
});
