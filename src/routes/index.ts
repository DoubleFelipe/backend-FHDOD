import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { authRoutes } from './auth.js';
import { userRoutes } from './user.js';
import { sectorRoutes } from './sector.js';
import { surveyRoutes } from './survey.js';
import { questionRoutes } from './question.js';
import { settingsRoutes } from './settings.js';
import { metricsRoutes } from './metrics.js';
import { complaintRoutes } from './complaint.js';
import { reportRoutes } from './report.js';

export async function apiRoutes(app: FastifyInstance) {
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(userRoutes);
  app.register(sectorRoutes);
  app.register(surveyRoutes);
  app.register(questionRoutes);
  app.register(settingsRoutes);
  app.register(metricsRoutes);
  app.register(complaintRoutes);
  app.register(reportRoutes);
}
