import type { FastifyRequest } from 'fastify';
import * as service from '../services/report.js';
import { reportQuery } from '../validators/report.js';
import { principalOf } from '../middlewares/auth.js';
export async function responses(request: FastifyRequest) {
  return service.responses(principalOf(request), reportQuery.parse(request.query));
}
