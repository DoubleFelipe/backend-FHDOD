import Fastify, { LogController } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config, corsOrigins } from './config/index.js';
import { openApiPaths } from './config/openapi.js';
import { registerErrors } from './middlewares/errors.js';
import { apiRoutes } from './routes/index.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    bodyLimit: 32 * 1024,
    requestIdHeader: 'x-request-id',
    logController: new LogController({ requestIdLogLabel: 'request_id' }),
  });
  app.register(helmet);
  app.register(cors, {
    origin: corsOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  });
  app.register(rateLimit, { max: config.RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW_MS });
  app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'FHDOD Survey API',
        version: '1.0.0',
        description: 'REST API for satisfaction surveys.',
      },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
  });
  app.register(swaggerUi, {
    routePrefix: '/api/docs',
    transformSpecification: (specification) => ({
      ...specification,
      openapi: '3.1.0',
      paths: openApiPaths,
    }),
  });
  registerErrors(app);
  app.register(apiRoutes, { prefix: '/api/v1' });
  return app;
}
