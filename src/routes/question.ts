import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/question.js';
import { requirePanel } from '../middlewares/auth.js';

export async function questionRoutes(app: FastifyInstance) {
  app.get('/questions', { preHandler: requirePanel }, controller.list);
  app.post('/questions', { preHandler: requirePanel }, controller.create);
  app.patch('/questions/:id', { preHandler: requirePanel }, controller.deactivate);
}
