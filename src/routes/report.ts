import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/report.js';
import { requirePanel } from '../middlewares/auth.js';

export async function reportRoutes(app: FastifyInstance) {
  app.get('/reports/responses', { preHandler: requirePanel }, controller.responses);
}
