import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/complaint.js';
import { requirePanel } from '../middlewares/auth.js';

export async function complaintRoutes(app: FastifyInstance) {
  app.get('/complaints', { preHandler: requirePanel }, controller.list);
  app.patch('/complaints/:id', { preHandler: requirePanel }, controller.update);
}
