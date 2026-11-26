import { applyRequestSchemas } from './openapi-schemas.js';
export const openApiPaths = {
  '/api/v1/health/live': {
    get: {
      summary: 'Liveness',
      tags: ['health'],
      responses: { '200': { description: 'Process is running' } },
    },
  },
  '/api/v1/health/ready': {
    get: {
      summary: 'Readiness',
      tags: ['health'],
      responses: {
        '200': { description: 'Dependencies are ready' },
        '503': { description: 'Dependency unavailable' },
      },
    },
  },
  '/api/v1/auth/login': {
    post: {
      summary: 'Login',
      tags: ['auth'],
      responses: {
        '200': { description: 'Tokens issued' },
        '401': { description: 'Invalid credentials' },
      },
    },
  },
  '/api/v1/auth/refresh': {
    post: {
      summary: 'Rotate refresh token',
      tags: ['auth'],
      responses: {
        '200': { description: 'Tokens rotated' },
        '401': { description: 'Invalid refresh token' },
      },
    },
  },
  '/api/v1/auth/logout': {
    post: {
      summary: 'Revoke refresh token',
      tags: ['auth'],
      responses: { '204': { description: 'Session revoked' } },
    },
  },
  '/api/v1/auth/password': {
    patch: {
      summary: 'Change password',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
      responses: { '204': { description: 'Password changed' } },
    },
  },
  '/api/v1/auth/me': {
    get: {
      summary: 'Read current profile',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Active profile' },
        '401': { description: 'Invalid session' },
      },
    },
  },
  '/api/v1/users': {
    get: {
      summary: 'List users (Admin only)',
      tags: ['users'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'User list' }, '403': { description: 'Admin only' } },
    },
    post: {
      summary: 'Create a user with a temporary password (Admin only)',
      tags: ['users'],
      security: [{ bearerAuth: [] }],
      responses: {
        '201': { description: 'User created and must change password' },
        '403': { description: 'Admin only' },
      },
    },
  },
  '/api/v1/surveys/public/{slug}': {
    get: {
      summary: 'Get published public survey',
      tags: ['surveys'],
      responses: {
        '200': { description: 'Published survey and active questions' },
        '404': { description: 'Survey not found' },
      },
    },
  },
  '/api/v1/surveys/public/{slug}/responses': {
    post: {
      summary: 'Submit an idempotent survey response',
      tags: ['surveys'],
      parameters: [
        { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '201': { description: 'Response created' },
        '200': { description: 'Previously submitted response' },
        '400': { description: 'Invalid response' },
      },
    },
  },
  '/api/v1/dashboard/metrics': {
    get: {
      summary: 'Get scoped dashboard metrics',
      tags: ['dashboard'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Metrics for permitted sectors' } },
    },
  },
  '/api/v1/sectors': {
    get: {
      summary: 'List permitted sectors',
      tags: ['sectors'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Sector list' } },
    },
    post: {
      summary: 'Create sector (Admin or Ombudsman)',
      tags: ['sectors'],
      security: [{ bearerAuth: [] }],
      responses: { '201': { description: 'Sector created' } },
    },
  },
  '/api/v1/sectors/public': {
    get: {
      summary: 'List sectors with published surveys',
      tags: ['sectors'],
      responses: { '200': { description: 'Public sector list' } },
    },
  },
  '/api/v1/surveys': {
    post: {
      summary: 'Publish survey (Admin, Ombudsman or assigned manager)',
      tags: ['surveys'],
      security: [{ bearerAuth: [] }],
      responses: { '201': { description: 'Survey published' } },
    },
  },
  '/api/v1/questions': {
    get: {
      summary: 'List active questions in authorized sectors',
      tags: ['questions'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Question list' } },
    },
    post: {
      summary: 'Create rating question in authorized sector',
      tags: ['questions'],
      security: [{ bearerAuth: [] }],
      responses: { '201': { description: 'Question created' } },
    },
  },
  '/api/v1/questions/{id}': {
    patch: {
      summary: 'Deactivate rating question',
      tags: ['questions'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Question deactivated' } },
    },
  },
  '/api/v1/settings/notifications': {
    get: {
      summary: 'Read notification settings',
      tags: ['settings'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Notification settings' } },
    },
    put: {
      summary: 'Update notification settings',
      tags: ['settings'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Notification settings saved' } },
    },
  },
  '/api/v1/complaints': {
    get: {
      summary: 'List scoped complaints',
      tags: ['complaints'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Paginated complaint list' } },
    },
  },
  '/api/v1/complaints/{id}': {
    patch: {
      summary: 'Update complaint status',
      tags: ['complaints'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Updated complaint status' },
        '403': { description: 'Sector access denied' },
      },
    },
  },
  '/api/v1/reports/responses': {
    get: {
      summary: 'List paginated responses',
      tags: ['reports'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Paginated response list' } },
    },
  },
  '/api/v1/tv/metrics': {
    get: {
      summary: 'Read public aggregate metrics',
      tags: ['dashboard'],
      responses: { '200': { description: 'Aggregate metrics only' } },
    },
  },
};

applyRequestSchemas(openApiPaths);
