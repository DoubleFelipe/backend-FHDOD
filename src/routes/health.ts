import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/health.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health/live', {}, controller.live);
  app.get('/health/ready', {}, controller.ready);
}
