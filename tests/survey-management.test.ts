import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Principal } from '../src/infrastructure/auth.js';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ pool: { query, connect: vi.fn() } }));
vi.mock('../src/models/auth.js', () => ({ findProfile: vi.fn() }));
import { findProfile } from '../src/models/auth.js';

const surveyId = '20000000-0000-4000-8000-000000000001';
let app: FastifyInstance;
let issueTokens: typeof import('../src/infrastructure/auth.js').issueTokens;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.ACCESS_TOKEN_SECRET = 'a'.repeat(40);
  process.env.REFRESH_TOKEN_SECRET = 'b'.repeat(40);
  const { buildApp } = await import('../src/app.js');
  ({ issueTokens } = await import('../src/infrastructure/auth.js'));
  app = buildApp();
  await app.ready();
});
beforeEach(() => {
  query.mockReset();
  vi.mocked(findProfile).mockReset();
});
afterAll(async () => {
  await app.close();
});

async function headers(role: Principal['role'], mustChangePassword = false) {
  const principal = { id: '40000000-0000-4000-8000-000000000001', role, mustChangePassword };
  vi.mocked(findProfile).mockResolvedValue({
    rows: [{ ...principal, email: 'test@example.test', full_name: 'Test', active: true }],
    rowCount: 1,
    command: 'SELECT',
    oid: 0,
    fields: [],
  });
  const tokens = await issueTokens(principal);
  return { authorization: `Bearer ${tokens.accessToken}` };
}

describe('survey management', () => {
  it.each(['GET', 'DELETE'] as const)('requires authentication for %s', async (method) => {
    const response = await app.inject({
      method,
      url: method === 'GET' ? '/api/v1/surveys' : `/api/v1/surveys/${surveyId}`,
    });
    expect(response.statusCode).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['GET', 'DELETE'] as const)('blocks sector managers from %s', async (method) => {
    const response = await app.inject({
      method,
      url: method === 'GET' ? '/api/v1/surveys' : `/api/v1/surveys/${surveyId}`,
      headers: await headers('sector_manager'),
    });
    expect(response.statusCode).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('blocks deletion until the temporary password is changed', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/surveys/${surveyId}`,
      headers: await headers('admin', true),
    });
    expect(response.statusCode).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['admin', 'ombudsman'] as const)('lists non-archived surveys for %s', async (role) => {
    const survey = {
      id: surveyId,
      title: 'Atendimento',
      status: 'published',
      sector_id: '10000000-0000-4000-8000-000000000001',
      sector_name: 'Recepção',
      sector_slug: 'recepcao',
    };
    query.mockResolvedValueOnce({ rowCount: 1, rows: [survey] });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/surveys',
      headers: await headers(role),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([survey]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("sv.status <> 'archived'"));
  });

  it.each(['admin', 'ombudsman'] as const)(
    'allows %s to remove publication without deleting history',
    async (role) => {
      query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: surveyId }] });
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/surveys/${surveyId}`,
        headers: await headers(role),
      });
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(query).toHaveBeenCalledExactlyOnceWith(
        "UPDATE surveys SET status = 'archived' WHERE id = $1 RETURNING id",
        [surveyId],
      );
    },
  );

  it('rejects invalid identifiers before any database access', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/surveys/not-a-uuid',
      headers: await headers('admin'),
    });
    expect(response.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('reports missing surveys', async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/surveys/${surveyId}`,
      headers: await headers('admin'),
    });
    expect(response.statusCode).toBe(404);
  });

  it('does not report success when persistence fails', async () => {
    query.mockRejectedValueOnce(new Error('Database unavailable'));
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/surveys/${surveyId}`,
      headers: await headers('admin'),
    });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('Database unavailable');
  });
});
