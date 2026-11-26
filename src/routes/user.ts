import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/user.js';
import { requirePanel } from '../middlewares/auth.js';

export async function userRoutes(app: FastifyInstance) {
  app.get('/users', { preHandler: requirePanel }, controller.list);
  app.post('/users', { preHandler: requirePanel }, controller.create);
}
