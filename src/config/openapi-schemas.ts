import { z } from 'zod';
import type { openApiPaths } from './openapi.js';
import { loginSchema, passwordSchema, refreshSchema } from '../validators/auth.js';
import { userSchema } from '../validators/user.js';
import { responseSchema, surveySchema } from '../validators/survey.js';
import { sectorSchema } from '../validators/sector.js';
import { questionSchema, deactivateSchema } from '../validators/question.js';
import { settingsSchema } from '../validators/settings.js';
import { complaintSchema, complaintQuery } from '../validators/complaint.js';
import { metricsQuery, reportQuery } from '../validators/report.js';
import { idParams, slugParams, sectorQuery } from '../validators/common.js';

function jsonSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { io: 'input' });
  delete json.$schema;
  return json;
}
function body(operation: object, schema: z.ZodType) {
  Object.assign(operation, {
    requestBody: {
      required: true,
      content: { 'application/json': { schema: jsonSchema(schema) } },
    },
  });
}
function parameters(schema: z.ZodType, location: 'path' | 'query') {
  const json = jsonSchema(schema);
  return Object.entries(json.properties ?? {}).map(([name, property]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name),
    schema: property,
  }));
}

// Descriptions remain in openapi.ts; request contracts reuse the executable Zod schemas.
export function applyRequestSchemas(paths: typeof openApiPaths) {
  body(paths['/api/v1/auth/login'].post, loginSchema);
  body(paths['/api/v1/auth/refresh'].post, refreshSchema);
  body(paths['/api/v1/auth/logout'].post, refreshSchema);
  body(paths['/api/v1/auth/password'].patch, passwordSchema);
  body(paths['/api/v1/users'].post, userSchema);
  body(paths['/api/v1/surveys/public/{slug}/responses'].post, responseSchema);
  body(paths['/api/v1/surveys'].post, surveySchema);
  body(paths['/api/v1/sectors'].post, sectorSchema);
  body(paths['/api/v1/questions'].post, questionSchema);
  body(paths['/api/v1/questions/{id}'].patch, deactivateSchema);
  body(paths['/api/v1/settings/notifications'].put, settingsSchema);
  body(paths['/api/v1/complaints/{id}'].patch, complaintSchema);

  Object.assign(paths['/api/v1/surveys/public/{slug}'].get, {
    parameters: parameters(slugParams, 'path'),
  });
  Object.assign(paths['/api/v1/questions/{id}'].patch, {
    parameters: parameters(idParams, 'path'),
  });
  Object.assign(paths['/api/v1/surveys/{id}'].delete, {
    parameters: parameters(idParams, 'path'),
  });
  Object.assign(paths['/api/v1/complaints/{id}'].patch, {
    parameters: parameters(idParams, 'path'),
  });
  Object.assign(paths['/api/v1/sectors'].get, { parameters: parameters(sectorQuery, 'query') });
  Object.assign(paths['/api/v1/dashboard/metrics'].get, {
    parameters: parameters(metricsQuery, 'query'),
  });
  Object.assign(paths['/api/v1/reports/responses'].get, {
    parameters: parameters(reportQuery, 'query'),
  });
  Object.assign(paths['/api/v1/complaints'].get, {
    parameters: parameters(complaintQuery, 'query'),
  });
}
