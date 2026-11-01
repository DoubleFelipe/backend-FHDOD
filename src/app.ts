import Fastify, { LogController, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { z } from 'zod';
import { config, corsOrigins } from './config.js';
import { pool } from './infrastructure/database.js';
import { hashPassword, hashToken, issueTokens, verifyAccess, verifyPassword, verifyRefresh, type Principal } from './infrastructure/auth.js';
import { AppError, forbidden, notFound } from './domain/errors.js';
import { average, calculateNps, satisfaction } from './domain/metrics.js';
import { getPublicSurvey, submitResponse } from './services/survey.js';
import { assertSectorAccess } from './services/access.js';

declare module 'fastify' { interface FastifyRequest { principal?: Principal } }
const id = z.string().uuid();
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).strict();
const responseSchema = z.object({ attendedAt: z.string().datetime(), npsScore: z.number().int().min(0).max(10), answers: z.array(z.object({ questionId: id, score: z.number().int().min(1).max(5), questionText: z.string().max(300) }).strict()).max(config.PUBLIC_SUBMISSION_MAX_FIELDS), complaint: z.object({ comment: z.string().max(2000).nullable().optional(), contact: z.string().max(30).optional(), consent: z.boolean() }).strict().optional() }).strict();
const authHeader = async (request: FastifyRequest) => {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
  request.principal = await verifyAccess(header.slice(7));
};
const requirePanel = async (request: FastifyRequest) => {
  await authHeader(request);
  if (request.principal?.mustChangePassword && !request.url.endsWith('/auth/password')) throw forbidden();
};
const stringQuery = z.string().optional();
const openApiPaths = {
  '/api/v1/health/live': { get: { summary: 'Liveness', tags: ['health'], responses: { '200': { description: 'Process is running' } } } },
  '/api/v1/health/ready': { get: { summary: 'Readiness', tags: ['health'], responses: { '200': { description: 'Dependencies are ready' }, '503': { description: 'Dependency unavailable' } } } },
  '/api/v1/auth/login': { post: { summary: 'Login', tags: ['auth'], responses: { '200': { description: 'Tokens issued' }, '401': { description: 'Invalid credentials' } } } },
  '/api/v1/auth/refresh': { post: { summary: 'Rotate refresh token', tags: ['auth'], responses: { '200': { description: 'Tokens rotated' }, '401': { description: 'Invalid refresh token' } } } },
  '/api/v1/auth/logout': { post: { summary: 'Revoke refresh token', tags: ['auth'], responses: { '204': { description: 'Session revoked' } } } },
  '/api/v1/auth/password': { patch: { summary: 'Change password', tags: ['auth'], security: [{ bearerAuth: [] }], responses: { '204': { description: 'Password changed' } } } },
  '/api/v1/auth/me': { get: { summary: 'Read current profile', tags: ['auth'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Active profile' }, '401': { description: 'Invalid session' } } } },
  '/api/v1/users': {
    get: { summary: 'List users (Admin only)', tags: ['users'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'User list' }, '403': { description: 'Admin only' } } },
    post: { summary: 'Create a user with a temporary password (Admin only)', tags: ['users'], security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, required: ['email', 'fullName', 'role', 'temporaryPassword'], properties: { email: { type: 'string', format: 'email', maxLength: 254 }, fullName: { type: 'string', minLength: 2, maxLength: 150 }, role: { type: 'string', enum: ['admin', 'ombudsman', 'sector_manager'] }, temporaryPassword: { type: 'string', minLength: 12, maxLength: 200 }, sectorIds: { type: 'array', maxItems: 100, items: { type: 'string', format: 'uuid' } } } } } } }, responses: { '201': { description: 'User created and must change password' }, '403': { description: 'Admin only' } } },
  },
  '/api/v1/surveys/public/{slug}': { get: { summary: 'Get published public survey', tags: ['surveys'], responses: { '200': { description: 'Published survey and active questions' }, '404': { description: 'Survey not found' } } } },
  '/api/v1/surveys/public/{slug}/responses': { post: { summary: 'Submit an idempotent survey response', tags: ['surveys'], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }, { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, required: ['attendedAt', 'npsScore', 'answers'], properties: { attendedAt: { type: 'string', format: 'date-time', description: 'Patient-entered appointment date and time, separate from submission time.' }, npsScore: { type: 'integer', minimum: 0, maximum: 10 }, answers: { type: 'array', maxItems: 100, items: { type: 'object', additionalProperties: false, required: ['questionId', 'score', 'questionText'], properties: { questionId: { type: 'string', format: 'uuid' }, score: { type: 'integer', minimum: 1, maximum: 5 }, questionText: { type: 'string', maxLength: 300 } } } }, complaint: { type: 'object', additionalProperties: false, required: ['consent'], properties: { comment: { type: ['string', 'null'], maxLength: 2000 }, contact: { type: 'string', maxLength: 30 }, consent: { type: 'boolean' } } } } } } } }, responses: { '201': { description: 'Response created' }, '200': { description: 'Previously submitted response' }, '400': { description: 'Invalid response' } } } },
  '/api/v1/dashboard/metrics': { get: { summary: 'Get scoped dashboard metrics', tags: ['dashboard'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Metrics for permitted sectors' } } } },
  '/api/v1/sectors': { get: { summary: 'List permitted sectors', tags: ['sectors'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Sector list' } } }, post: { summary: 'Create sector (Admin or Ombudsman)', tags: ['sectors'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Sector created' } } } },
  '/api/v1/surveys': { post: { summary: 'Publish survey (Admin or Ombudsman)', tags: ['surveys'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Survey published' } } } },
  '/api/v1/questions': { get: { summary: 'List active questions (Admin or Ombudsman)', tags: ['questions'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Question list' } } }, post: { summary: 'Create rating question (Admin or Ombudsman)', tags: ['questions'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Question created' } } } },
  '/api/v1/questions/{id}': { patch: { summary: 'Deactivate rating question', tags: ['questions'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Question deactivated' } } } },
  '/api/v1/settings/notifications': { get: { summary: 'Read notification settings', tags: ['settings'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Notification settings' } } }, put: { summary: 'Update notification settings', tags: ['settings'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Notification settings saved' } } } },
  '/api/v1/complaints': { get: { summary: 'List scoped complaints', tags: ['complaints'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Paginated complaint list' } } } },
  '/api/v1/complaints/{id}': { patch: { summary: 'Update complaint status', tags: ['complaints'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Updated complaint status' }, '403': { description: 'Sector access denied' } } } },
  '/api/v1/reports/responses': { get: { summary: 'List paginated responses', tags: ['reports'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Paginated response list' } } } },
  '/api/v1/tv/metrics': { get: { summary: 'Read public aggregate metrics', tags: ['dashboard'], responses: { '200': { description: 'Aggregate metrics only' } } } },
};

export function buildApp() {
  const app = Fastify({ logger: { level: config.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] }, bodyLimit: 32 * 1024, requestIdHeader: 'x-request-id', logController: new LogController({ requestIdLogLabel: 'request_id' }) });
  app.addHook('onRoute', (route) => {
    const schema = route.schema ?? {};
    route.schema = { ...schema, summary: `${route.method} ${route.url}`, tags: ['FHDOD API'] };
  });
  app.register(helmet);
  app.register(cors, { origin: corsOrigins, credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'] });
  app.register(rateLimit, { max: config.RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS });
  app.register(swagger, { openapi: { openapi: '3.1.0', info: { title: 'FHDOD Survey API', version: '1.0.0', description: 'REST API for satisfaction surveys.' }, servers: [{ url: '/' }], components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } } });
  app.register(swaggerUi, { routePrefix: '/api/docs', transformSpecification: (specification) => ({ ...specification, openapi: '3.1.0', paths: openApiPaths }) });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', requestId: request.id } });
    if (error instanceof AppError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message, requestId: request.id } });
    request.log.error({ err: error, requestId: request.id }, 'request failed');
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id } });
  });

  app.get('/api/v1/health/live', async () => ({ status: 'ok' }));
  app.get('/api/v1/health/ready', async (_request, reply) => {
    try { await pool.query('SELECT 1'); return { status: 'ready' }; }
    catch { return reply.code(503).send({ status: 'unavailable' }); }
  });
  app.post('/api/v1/auth/login', { config: { rateLimit: { max: config.LOGIN_RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS } } }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const found = await pool.query('SELECT id, email, password_hash, role, must_change_password FROM profiles WHERE email = $1 AND active = true', [input.email.toLowerCase()]);
    const user = found.rows[0];
    if (!user || !(await verifyPassword(user.password_hash as string, input.password))) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    const principal = { id: user.id as string, role: user.role as Principal['role'], mustChangePassword: user.must_change_password as boolean };
    const tokens = await issueTokens(principal);
    await pool.query('INSERT INTO refresh_sessions (jti, profile_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)', [tokens.refreshJti, principal.id, hashToken(tokens.refreshToken), new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000)]);
    return reply.send({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenType: 'Bearer', expiresIn: config.ACCESS_TOKEN_TTL_SECONDS, mustChangePassword: principal.mustChangePassword });
  });
  app.post('/api/v1/auth/refresh', { config: { rateLimit: { max: config.LOGIN_RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS } } }, async (request) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20).max(4096) }).strict().parse(request.body);
    const token = await verifyRefresh(refreshToken);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const saved = await client.query('SELECT p.id, p.role, p.must_change_password FROM refresh_sessions rs JOIN profiles p ON p.id = rs.profile_id WHERE rs.jti = $1 AND rs.token_hash = $2 AND rs.revoked_at IS NULL AND rs.expires_at > now() AND p.active = true FOR UPDATE', [token.jti, hashToken(refreshToken)]);
      if (!saved.rowCount || saved.rows[0].id !== token.userId) throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      await client.query('UPDATE refresh_sessions SET revoked_at = now() WHERE jti = $1', [token.jti]);
      const principal = { id: saved.rows[0].id as string, role: saved.rows[0].role as Principal['role'], mustChangePassword: saved.rows[0].must_change_password as boolean };
      const next = await issueTokens(principal);
      await client.query('INSERT INTO refresh_sessions (jti, profile_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)', [next.refreshJti, principal.id, hashToken(next.refreshToken), new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000)]);
      await client.query('COMMIT');
      return { accessToken: next.accessToken, refreshToken: next.refreshToken, tokenType: 'Bearer', expiresIn: config.ACCESS_TOKEN_TTL_SECONDS, mustChangePassword: principal.mustChangePassword };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  app.post('/api/v1/auth/logout', async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20).max(4096) }).strict().parse(request.body);
    const token = await verifyRefresh(refreshToken);
    await pool.query('UPDATE refresh_sessions SET revoked_at = now() WHERE jti = $1 AND token_hash = $2 AND revoked_at IS NULL', [token.jti, hashToken(refreshToken)]);
    return reply.code(204).send();
  });
  app.patch('/api/v1/auth/password', { preHandler: authHeader }, async (request, reply) => {
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200) }).strict().parse(request.body);
    const result = await pool.query('SELECT password_hash FROM profiles WHERE id = $1 AND active = true', [request.principal!.id]);
    if (!result.rowCount || !(await verifyPassword(result.rows[0].password_hash as string, currentPassword))) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    await pool.query('UPDATE profiles SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1', [request.principal!.id, await hashPassword(newPassword)]);
    return reply.code(204).send();
  });
  app.get('/api/v1/auth/me', { preHandler: authHeader }, async (request) => {
    const result = await pool.query('SELECT id, email, full_name, role, active, must_change_password AS "mustChangePassword" FROM profiles WHERE id = $1 AND active = true', [request.principal!.id]);
    if (!result.rowCount) throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    return result.rows[0];
  });

  app.get('/api/v1/users', { preHandler: requirePanel }, async (request) => {
    if (request.principal!.role !== 'admin') throw forbidden();
    const result = await pool.query('SELECT id, email, full_name, role, active, must_change_password AS "mustChangePassword", created_at FROM profiles ORDER BY full_name, email');
    return result.rows;
  });
  app.post('/api/v1/users', { preHandler: requirePanel }, async (request, reply) => {
    if (request.principal!.role !== 'admin') throw forbidden();
    const input = z.object({
      email: z.string().email().max(254),
      fullName: z.string().trim().min(2).max(150),
      role: z.enum(['admin', 'ombudsman', 'sector_manager']),
      temporaryPassword: z.string().min(12).max(200),
      sectorIds: z.array(id).max(100).default([]),
    }).strict().parse(request.body);
    if ((input.role === 'sector_manager' && input.sectorIds.length === 0) || (input.role !== 'sector_manager' && input.sectorIds.length > 0)) {
      throw new AppError(400, 'Invalid sector assignments', 'VALIDATION_ERROR');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const profile = await client.query(
        'INSERT INTO profiles (email, full_name, password_hash, role, active, must_change_password) VALUES ($1, $2, $3, $4, true, true) RETURNING id, email, full_name, role, active, must_change_password AS "mustChangePassword", created_at',
        [input.email.toLowerCase(), input.fullName, await hashPassword(input.temporaryPassword), input.role],
      );
      if (input.sectorIds.length) {
        await client.query('INSERT INTO sector_managers (profile_id, sector_id) SELECT $1, requested.sector_id FROM unnest($2::uuid[]) AS requested(sector_id) JOIN sectors s ON s.id = requested.sector_id AND s.active = true', [profile.rows[0].id, input.sectorIds]);
        const assigned = await client.query('SELECT count(*)::int AS count FROM sector_managers WHERE profile_id = $1', [profile.rows[0].id]);
        if (assigned.rows[0].count !== input.sectorIds.length) throw new AppError(400, 'Invalid sector assignments', 'VALIDATION_ERROR');
      }
      await client.query('COMMIT');
      return reply.code(201).send(profile.rows[0]);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });

  app.get('/api/v1/surveys/public/:slug', async (request) => getPublicSurvey(z.object({ slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/) }).parse(request.params).slug));
  app.post('/api/v1/surveys/public/:slug/responses', { config: { rateLimit: { max: config.PUBLIC_SUBMISSION_RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS } } }, async (request, reply) => {
    const slug = z.object({ slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/) }).parse(request.params).slug;
  const key = id.parse(request.headers['idempotency-key']);
    const result = await submitResponse(slug, key, responseSchema.parse(request.body));
    return reply.code(result.repeated ? 200 : 201).send(result);
  });

  app.get('/api/v1/sectors', { preHandler: requirePanel }, async (request) => {
    const client = await pool.connect();
    try {
      const sectorId = stringQuery.parse((request.query as Record<string, unknown>).sectorId);
      if (sectorId) await assertSectorAccess(client, request.principal!, id.parse(sectorId));
      const result = ['admin', 'ombudsman'].includes(request.principal!.role)
        ? await client.query('SELECT id, name, slug, active FROM sectors ORDER BY name')
        : await client.query('SELECT s.id, s.name, s.slug, s.active FROM sectors s JOIN sector_managers sm ON sm.sector_id = s.id WHERE sm.profile_id = $1 ORDER BY s.name', [request.principal!.id]);
      return sectorId ? result.rows.filter((row) => row.id === sectorId) : result.rows;
    } finally { client.release(); }
  });
  app.post('/api/v1/sectors', { preHandler: requirePanel }, async (request, reply) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const input = z.object({ name: z.string().trim().min(2).max(100), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100) }).strict().parse(request.body);
    const result = await pool.query('INSERT INTO sectors (name, slug) VALUES ($1, $2) RETURNING id, name, slug, active', [input.name, input.slug]);
    return reply.code(201).send(result.rows[0]);
  });
  app.get('/api/v1/questions', { preHandler: requirePanel }, async (request) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const result = await pool.query('SELECT id, text, kind, sector_id, position, active FROM questions WHERE active = true ORDER BY position, id');
    return result.rows;
  });
  app.post('/api/v1/surveys', { preHandler: requirePanel }, async (request, reply) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const input = z.object({ sector_id: id, title: z.string().trim().min(2).max(150), tablet_reset_seconds: z.number().int().min(10).max(120) }).strict().parse(request.body);
    const result = await pool.query("INSERT INTO surveys (sector_id, title, tablet_reset_seconds, status, published_at) VALUES ($1, $2, $3, 'published', now()) RETURNING id, sector_id, title, status, tablet_reset_seconds", [input.sector_id, input.title, input.tablet_reset_seconds]);
    return reply.code(201).send(result.rows[0]);
  });
  app.post('/api/v1/questions', { preHandler: requirePanel }, async (request, reply) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const input = z.object({ text: z.string().trim().min(3).max(300), position: z.number().int().min(0).max(1000), sector_id: id.nullable() }).strict().parse(request.body);
    const result = await pool.query("INSERT INTO questions (text, position, sector_id, kind, required) VALUES ($1, $2, $3, 'rating', false) RETURNING id, text, kind, sector_id, position, active", [input.text, input.position, input.sector_id]);
    return reply.code(201).send(result.rows[0]);
  });
  app.patch('/api/v1/questions/:id', { preHandler: requirePanel }, async (request) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const questionId = id.parse((request.params as Record<string, unknown>).id);
    const input = z.object({ active: z.literal(false) }).strict().parse(request.body);
    const result = await pool.query("UPDATE questions SET active = $2 WHERE id = $1 AND kind = 'rating' RETURNING id, active", [questionId, input.active]);
    if (!result.rowCount) throw notFound(); return result.rows[0];
  });
  app.get('/api/v1/settings/notifications', { preHandler: requirePanel }, async (request) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const result = await pool.query('SELECT notification_emails, notifications_enabled FROM app_settings WHERE id = true');
    return result.rows[0] ?? { notification_emails: [], notifications_enabled: false };
  });
  app.put('/api/v1/settings/notifications', { preHandler: requirePanel }, async (request) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const input = z.object({ notification_emails: z.array(z.string().email()).max(20), notifications_enabled: z.boolean() }).strict().parse(request.body);
    const result = await pool.query('INSERT INTO app_settings (id, notification_emails, notifications_enabled) VALUES (true, $1, $2) ON CONFLICT (id) DO UPDATE SET notification_emails = EXCLUDED.notification_emails, notifications_enabled = EXCLUDED.notifications_enabled, updated_at = now() RETURNING notification_emails, notifications_enabled', [input.notification_emails, input.notifications_enabled]);
    return result.rows[0];
  });
  app.get('/api/v1/dashboard/metrics', { preHandler: requirePanel }, async (request) => {
    const query = z.object({ sectorId: id.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), shift: z.enum(['morning', 'afternoon', 'night']).optional() }).strict().parse(request.query);
    const client = await pool.connect();
    try {
      if (query.sectorId) await assertSectorAccess(client, request.principal!, query.sectorId);
      const params: unknown[] = [request.principal!.id, ['admin', 'ombudsman'].includes(request.principal!.role), query.sectorId ?? null, query.from ?? null, query.to ?? null, query.shift ?? null];
      const rows = await client.query(`SELECT r.nps, sv.sector_id, s.name AS sector_name FROM responses r JOIN surveys sv ON sv.id = r.survey_id JOIN sectors s ON s.id = sv.sector_id WHERE ($2::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $1)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) >= $4) AND ($5::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) < $5) AND ($6::work_shift IS NULL OR r.shift = $6)`, params);
      const ratings = await client.query(`SELECT a.value, sv.sector_id FROM answers a JOIN responses r ON r.id = a.response_id JOIN surveys sv ON sv.id = r.survey_id JOIN questions q ON q.id = a.question_id WHERE q.kind = 'rating' AND ($2::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $1)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) >= $4) AND ($5::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) < $5) AND ($6::work_shift IS NULL OR r.shift = $6)`, params);
      const scores = rows.rows.map((row) => Number(row.nps));
      const ratingScores = ratings.rows.map((row) => Number(row.value));
      const promoters = scores.filter((score) => score >= 9).length;
      const detractors = scores.filter((score) => score <= 6).length;
      const sectorMap = new Map<string, { id: string; name: string; npsScores: number[]; ratings: number[] }>();
      for (const row of rows.rows) {
        const entry: { id: string; name: string; npsScores: number[]; ratings: number[] } = sectorMap.get(row.sector_id) ?? { id: String(row.sector_id), name: String(row.sector_name), npsScores: [], ratings: [] };
        entry.npsScores.push(Number(row.nps)); sectorMap.set(row.sector_id, entry);
      }
      for (const row of ratings.rows) {
        const entry = sectorMap.get(row.sector_id);
        if (entry) entry.ratings.push(Number(row.value));
      }
      return { total: scores.length, count: scores.length, nps: calculateNps(scores), average: average(ratingScores), averageNpsScore: average(scores), satisfaction: satisfaction(ratingScores), satisfactionPercent: satisfaction(ratingScores), promoters, passives: scores.filter((score) => score >= 7 && score <= 8).length, detractors, ratings: ratingScores.length, distribution: [1,2,3,4,5].map((value) => ({ value, count: ratingScores.filter((score) => score === value).length })), sectors: [...sectorMap.values()].map((sector) => ({ id: sector.id, name: sector.name, total: sector.npsScores.length, nps: calculateNps(sector.npsScores), average: average(sector.ratings) })) };
    } finally { client.release(); }
  });
  app.get('/api/v1/tv/metrics', async () => {
    const responses = await pool.query('SELECT nps FROM responses');
    const ratings = await pool.query("SELECT value FROM answers");
    const nps = responses.rows.map((row) => Number(row.nps));
    const values = ratings.rows.map((row) => Number(row.value));
    return { total: nps.length, nps: calculateNps(nps), average: average(values), satisfaction: satisfaction(values), promoters: nps.filter((v) => v >= 9).length, passives: nps.filter((v) => v >= 7 && v <= 8).length, detractors: nps.filter((v) => v <= 6).length, ratings: values.length, distribution: [1,2,3,4,5].map((value) => ({ value, count: values.filter((v) => v === value).length })), sectors: [] };
  });
  app.get('/api/v1/complaints', { preHandler: requirePanel }, async (request) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const query = z.object({ sectorId: id.optional(), status: z.enum(['open', 'in_progress', 'closed']).optional(), limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().parse(request.query);
    const client = await pool.connect();
    try {
      if (query.sectorId) await assertSectorAccess(client, request.principal!, query.sectorId);
      const rows = await client.query(`SELECT c.id, c.response_id, c.comment, c.contact, c.contact_consent, c.status, c.created_at, sv.sector_id FROM complaints c JOIN responses r ON r.id = c.response_id JOIN surveys sv ON sv.id = r.survey_id WHERE ($1::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $2)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::complaint_status IS NULL OR c.status = $4) ORDER BY c.created_at DESC LIMIT $5 OFFSET $6`, [['admin', 'ombudsman'].includes(request.principal!.role), request.principal!.id, query.sectorId ?? null, query.status ?? null, query.limit, query.offset]);
      return { items: rows.rows, limit: query.limit, offset: query.offset };
    } finally { client.release(); }
  });
  app.patch('/api/v1/complaints/:id', { preHandler: requirePanel }, async (request) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const complaintId = id.parse((request.params as Record<string, unknown>).id);
    const input = z.object({ status: z.enum(['open', 'in_progress', 'closed']) }).strict().parse(request.body);
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT sv.sector_id FROM complaints c JOIN responses r ON r.id = c.response_id JOIN surveys sv ON sv.id = r.survey_id WHERE c.id = $1', [complaintId]);
      if (!result.rowCount) throw notFound();
      await assertSectorAccess(client, request.principal!, result.rows[0].sector_id as string);
      const updated = await client.query('UPDATE complaints SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, status, updated_at', [complaintId, input.status]);
      return updated.rows[0];
    } finally { client.release(); }
  });
  app.get('/api/v1/reports/responses', { preHandler: requirePanel }, async (request) => {
    if (!['admin', 'ombudsman'].includes(request.principal!.role)) throw forbidden();
    const query = z.object({ sectorId: id.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), shift: z.enum(['morning', 'afternoon', 'night']).optional(), limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().parse(request.query);
    const client = await pool.connect();
    try {
      if (query.sectorId) await assertSectorAccess(client, request.principal!, query.sectorId);
      const privileged = ['admin', 'ombudsman'].includes(request.principal!.role);
      const result = await client.query(`SELECT r.id, sv.sector_id, s.name AS sector_name, r.nps, r.shift, r.attended_at, r.created_at,
        COALESCE((SELECT json_agg(json_build_object('questionId', a.question_id, 'questionText', a.question_text, 'score', a.value) ORDER BY a.id) FROM answers a WHERE a.response_id = r.id), '[]'::json) AS answers,
        CASE WHEN $9::boolean THEN (SELECT json_build_object('comment', c.comment, 'contact', c.contact, 'contactConsent', c.contact_consent, 'status', c.status) FROM complaints c WHERE c.response_id = r.id) ELSE NULL END AS complaint
        FROM responses r JOIN surveys sv ON sv.id = r.survey_id JOIN sectors s ON s.id = sv.sector_id
        WHERE ($1::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $2)) AND ($3::uuid IS NULL OR sv.sector_id = $3)
        AND ($4::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) >= $4) AND ($5::timestamptz IS NULL OR COALESCE(r.attended_at, r.created_at) < $5)
        AND ($6::work_shift IS NULL OR r.shift = $6) ORDER BY r.created_at DESC LIMIT $7 OFFSET $8`, [privileged, request.principal!.id, query.sectorId ?? null, query.from ?? null, query.to ?? null, query.shift ?? null, query.limit, query.offset, privileged]);
      return { items: result.rows, limit: query.limit, offset: query.offset };
    } finally { client.release(); }
  });
  return app;
}
