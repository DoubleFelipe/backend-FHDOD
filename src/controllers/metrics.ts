import type { FastifyRequest } from 'fastify';
import * as service from '../services/metrics.js';
import { metricsQuery } from '../validators/report.js';
import { principalOf } from '../middlewares/auth.js';
export async function dashboard(request: FastifyRequest) {
  return service.dashboard(principalOf(request), metricsQuery.parse(request.query));
}
export async function publicMetrics() {
  return service.publicMetrics();
}
