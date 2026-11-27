import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/metrics.js';
import { requirePanel } from '../middlewares/auth.js';

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/dashboard/metrics', { preHandler: requirePanel }, controller.dashboard);
  app.get('/tv/metrics', {}, controller.publicMetrics);
}
