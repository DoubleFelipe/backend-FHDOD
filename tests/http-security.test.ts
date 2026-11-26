import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, HTTPMethods } from 'fastify';
import { buildApp } from '../src/app.js';
import { config } from '../src/config/index.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = buildApp();
  await app.ready();
});
afterAll(async () => {
  await app?.close();
});

const protectedOperations: [HTTPMethods, string][] = [
  ['GET', '/auth/me'],
  ['PATCH', '/auth/password'],
  ['GET', '/users'],
  ['POST', '/users'],
  ['GET', '/sectors'],
  ['POST', '/sectors'],
  ['POST', '/surveys'],
  ['GET', '/questions'],
  ['POST', '/questions'],
  ['PATCH', '/questions/00000000-0000-4000-8000-000000000001'],
  ['GET', '/settings/notifications'],
  ['PUT', '/settings/notifications'],
  ['GET', '/dashboard/metrics'],
  ['GET', '/complaints'],
  ['PATCH', '/complaints/00000000-0000-4000-8000-000000000001'],
  ['GET', '/reports/responses'],
];
describe('HTTP security without database connections', () => {
  it.each(protectedOperations)('requires bearer authentication for %s %s', async (method, path) => {
    const response = await app.inject({ method, url: `/api/v1${path}` });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });
  it('rejects malformed JWTs before querying the database', async () => {
    const response = await app.inject({
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer invalid' },
    });
    expect(response.statusCode).toBe(401);
  });
  it('returns 400 for malformed JSON and 413 for oversized bodies', async () => {
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe('BAD_REQUEST');
    const large = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'x'.repeat(33000) },
    });
    expect(large.statusCode).toBe(413);
    expect(large.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });
  it('returns 415 for unsupported media types', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/xml' },
      payload: '<login />',
    });
    expect(response.statusCode).toBe(415);
  });
  it('allows configured CORS origins and omits permission for unknown origins', async () => {
    const allowed = await app.inject({
      url: '/api/v1/health/live',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const denied = await app.inject({
      url: '/api/v1/health/live',
      headers: { origin: 'https://untrusted.example' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/password',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-methods']).toContain('PATCH');
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
  });
  it('preserves 429 and retry headers when login rate limit is exceeded', async () => {
    const original = config.LOGIN_RATE_LIMIT_MAX;
    config.LOGIN_RATE_LIMIT_MAX = 2;
    const limited = buildApp();
    try {
      await limited.ready();
      config.LOGIN_RATE_LIMIT_MAX = original;
      const request = () =>
        limited.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {} });
      expect((await request()).statusCode).toBe(400);
      expect((await request()).statusCode).toBe(400);
      const response = await request();
      expect(response.statusCode).toBe(429);
      expect(response.json().error.code).toBe('RATE_LIMITED');
      expect(response.headers['retry-after']).toBeDefined();
    } finally {
      config.LOGIN_RATE_LIMIT_MAX = original;
      await limited.close();
    }
  });
});
