import type { FastifyRequest } from 'fastify';
import * as service from '../services/settings.js';
import { settingsSchema } from '../validators/settings.js';
import { principalOf } from '../middlewares/auth.js';
export async function get(request: FastifyRequest) {
  return service.get(principalOf(request));
}
export async function update(request: FastifyRequest) {
  return service.update(principalOf(request), settingsSchema.parse(request.body));
}
