import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/survey.js';
import { config } from '../config/index.js';
import { requirePanel } from '../middlewares/auth.js';

export async function surveyRoutes(app: FastifyInstance) {
  app.get('/surveys/public/:slug', {}, controller.publicSurvey);
  app.post(
    '/surveys/public/:slug/responses',
    {
      config: {
        rateLimit: {
          max: config.PUBLIC_SUBMISSION_RATE_LIMIT_MAX,
          timeWindow: config.RATE_LIMIT_WINDOW_MS,
        },
      },
    },
    controller.submit,
  );
  app.post('/surveys', { preHandler: requirePanel }, controller.publish);
  app.get('/surveys', { preHandler: requirePanel }, controller.list);
  app.delete('/surveys/:id', { preHandler: requirePanel }, controller.archive);
}
