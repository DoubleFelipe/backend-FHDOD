import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.ACCESS_TOKEN_SECRET = 'a'.repeat(40);
  process.env.REFRESH_TOKEN_SECRET = 'b'.repeat(40);
  const { buildApp } = await import('./app.js');
  app = buildApp();
  await app.ready();
});
describe('HTTP API', () => {
  it('serves liveness without a database dependency', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
  it('rejects a submission without an idempotency key', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/surveys/public/sample/responses', payload: { npsScore: 7, answers: [] } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
  it('publishes OpenAPI UI', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/docs' });
    expect(response.statusCode).toBe(200);
    const specResponse = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const specification = specResponse.json();
    expect(specification.openapi).toBe('3.1.0');
    expect(specification.paths).toHaveProperty('/api/v1/auth/login');
    expect(specification.paths['/api/v1/users'].post.requestBody.required).toBe(true);
    const submission = specification.paths['/api/v1/surveys/public/{slug}/responses'].post;
    expect(submission.parameters).toContainEqual(expect.objectContaining({ name: 'Idempotency-Key', in: 'header', required: true }));
    expect(submission.requestBody.content['application/json'].schema.required).toContain('attendedAt');
  });
});
