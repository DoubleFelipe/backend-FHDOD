import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/sector.js';
import { requirePanel } from '../middlewares/auth.js';

export async function sectorRoutes(app: FastifyInstance) {
  app.get('/sectors', { preHandler: requirePanel }, controller.list);
  app.get('/sectors/public', {}, controller.publicSectors);
  app.post('/sectors', { preHandler: requirePanel }, controller.create);
}
