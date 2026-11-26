import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/settings.js';
import { requirePanel } from '../middlewares/auth.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/settings/notifications', { preHandler: requirePanel }, controller.get);
  app.put('/settings/notifications', { preHandler: requirePanel }, controller.update);
}
