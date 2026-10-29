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
const responseSchema = z.object({ npsScore: z.number().int().min(0).max(10), answers: z.array(z.object({ questionId: id, score: z.number().int().min(1).max(5), questionText: z.string().max(300) }).strict()).max(config.PUBLIC_SUBMISSION_MAX_FIELDS), complaint: z.object({ comment: z.string().max(2000).nullable().optional(), contact: z.string().max(30).optional(), consent: z.boolean() }).strict().optional() }).strict();
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
  '/api/v1/surveys/public/{slug}': { get: { summary: 'Get published public survey', tags: ['surveys'], responses: { '200': { description: 'Published survey and active questions' }, '404': { description: 'Survey not found' } } } },
  '/api/v1/surveys/public/{slug}/responses': { post: { summary: 'Submit an idempotent survey response', tags: ['surveys'], responses: { '201': { description: 'Response created' }, '200': { description: 'Previously submitted response' }, '400': { description: 'Invalid response' } } } },
  '/api/v1/dashboard/metrics': { get: { summary: 'Get scoped dashboard metrics', tags: ['dashboard'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Metrics for permitted sectors' } } } },
  '/api/v1/sectors': { get: { summary: 'List permitted sectors', tags: ['sectors'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Sector list' } } } },
  '/api/v1/complaints': { get: { summary: 'List scoped complaints', tags: ['complaints'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Paginated complaint list' } } } },
  '/api/v1/complaints/{id}': { patch: { summary: 'Update complaint status', tags: ['complaints'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Updated complaint status' }, '403': { description: 'Sector access denied' } } } },
  '/api/v1/reports/responses': { get: { summary: 'List paginated responses', tags: ['reports'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Paginated response list' } } } },
};

export function buildApp() {
  const app = Fastify({ logger: { level: config.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] }, bodyLimit: 32 * 1024, requestIdHeader: 'x-request-id', logController: new LogController({ requestIdLogLabel: 'request_id' }) });
  app.addHook('onRoute', (route) => {
    const schema = route.schema ?? {};
    route.schema = { ...schema, summary: `${route.method} ${route.url}`, tags: ['FHDOD API'] };
  });
  app.register(helmet);
  app.register(cors, { origin: corsOrigins, credentials: false, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
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
      const result = request.principal!.role === 'admin'
        ? await client.query('SELECT id, name, slug, active FROM sectors ORDER BY name')
        : await client.query('SELECT s.id, s.name, s.slug, s.active FROM sectors s JOIN sector_managers sm ON sm.sector_id = s.id WHERE sm.profile_id = $1 ORDER BY s.name', [request.principal!.id]);
      return sectorId ? result.rows.filter((row) => row.id === sectorId) : result.rows;
    } finally { client.release(); }
  });
  app.get('/api/v1/dashboard/metrics', { preHandler: requirePanel }, async (request) => {
    const query = z.object({ sectorId: id.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), shift: z.enum(['morning', 'afternoon', 'night']).optional() }).strict().parse(request.query);
    const client = await pool.connect();
    try {
      if (query.sectorId) await assertSectorAccess(client, request.principal!, query.sectorId);
      const params: unknown[] = [request.principal!.id, request.principal!.role === 'admin', query.sectorId ?? null, query.from ?? null, query.to ?? null, query.shift ?? null];
      const rows = await client.query(`SELECT r.nps FROM responses r JOIN surveys sv ON sv.id = r.survey_id WHERE ($2::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $1)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::timestamptz IS NULL OR r.created_at >= $4) AND ($5::timestamptz IS NULL OR r.created_at < $5) AND ($6::work_shift IS NULL OR r.shift = $6)`, params);
      const ratings = await client.query(`SELECT a.value FROM answers a JOIN responses r ON r.id = a.response_id JOIN surveys sv ON sv.id = r.survey_id JOIN questions q ON q.id = a.question_id WHERE q.kind = 'rating' AND ($2::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $1)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::timestamptz IS NULL OR r.created_at >= $4) AND ($5::timestamptz IS NULL OR r.created_at < $5) AND ($6::work_shift IS NULL OR r.shift = $6)`, params);
      const scores = rows.rows.map((row) => Number(row.nps));
      return { count: scores.length, nps: calculateNps(scores), averageNpsScore: average(scores), satisfactionPercent: satisfaction(ratings.rows.map((row) => Number(row.value))) };
    } finally { client.release(); }
  });
  app.get('/api/v1/complaints', { preHandler: requirePanel }, async (request) => {
    const query = z.object({ sectorId: id.optional(), status: z.enum(['open', 'in_progress', 'closed']).optional(), limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().parse(request.query);
    const client = await pool.connect();
    try {
      if (query.sectorId) await assertSectorAccess(client, request.principal!, query.sectorId);
      const rows = await client.query(`SELECT c.id, c.response_id, c.comment, c.contact, c.contact_consent, c.status, c.created_at, sv.sector_id FROM complaints c JOIN responses r ON r.id = c.response_id JOIN surveys sv ON sv.id = r.survey_id WHERE ($1::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $2)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::complaint_status IS NULL OR c.status = $4) ORDER BY c.created_at DESC LIMIT $5 OFFSET $6`, [request.principal!.role === 'admin', request.principal!.id, query.sectorId ?? null, query.status ?? null, query.limit, query.offset]);
      return { items: rows.rows, limit: query.limit, offset: query.offset };
    } finally { client.release(); }
  });
  app.patch('/api/v1/complaints/:id', { preHandler: requirePanel }, async (request) => {
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
    const query = z.object({ sectorId: id.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), shift: z.enum(['morning', 'afternoon', 'night']).optional(), limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().parse(request.query);
    const client = await pool.connect();
    try {
      if (query.sectorId) await assertSectorAccess(client, request.principal!, query.sectorId);
      const result = await client.query(`SELECT r.id, sv.sector_id, r.nps, r.shift, r.created_at FROM responses r JOIN surveys sv ON sv.id = r.survey_id WHERE ($1::boolean OR sv.sector_id IN (SELECT sector_id FROM sector_managers WHERE profile_id = $2)) AND ($3::uuid IS NULL OR sv.sector_id = $3) AND ($4::timestamptz IS NULL OR r.created_at >= $4) AND ($5::timestamptz IS NULL OR r.created_at < $5) AND ($6::work_shift IS NULL OR r.shift = $6) ORDER BY r.created_at DESC LIMIT $7 OFFSET $8`, [request.principal!.role === 'admin', request.principal!.id, query.sectorId ?? null, query.from ?? null, query.to ?? null, query.shift ?? null, query.limit, query.offset]);
      return { items: result.rows, limit: query.limit, offset: query.offset };
    } finally { client.release(); }
  });
  return app;
}
