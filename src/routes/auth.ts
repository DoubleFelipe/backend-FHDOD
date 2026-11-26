import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/auth.js';
import { config } from '../config/index.js';
import { authenticate } from '../middlewares/auth.js';

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: { max: config.LOGIN_RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS },
      },
    },
    controller.login,
  );
  app.post(
    '/auth/refresh',
    {
      config: {
        rateLimit: { max: config.LOGIN_RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS },
      },
    },
    controller.refresh,
  );
  app.post('/auth/logout', {}, controller.logout);
  app.patch('/auth/password', { preHandler: authenticate }, controller.changePassword);
  app.get('/auth/me', { preHandler: authenticate }, controller.me);
}
