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
        title: 'API FHDOD — Pesquisa de Satisfação',
        version: '1.0.0',
        description:
          'API REST para pesquisas de satisfação, autenticação e administração. Rotas de negócio usam o prefixo `/api/v1`. Rotas privadas exigem token Bearer, exceto login, renovação e encerramento de sessão. Erros seguem `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`. A URL de produção informada é https://backend-fhdod.onrender.com.',
      },
      servers: [
        { url: '/', description: 'Servidor atual (local ou hospedado)' },
        {
          url: 'https://backend-fhdod.onrender.com',
          description: 'Produção informada pelo responsável',
        },
      ],
      tags: [
        { name: 'health', description: 'Verificação de atividade e prontidão da API.' },
        { name: 'auth', description: 'Login, sessão e perfil autenticado.' },
        { name: 'users', description: 'Contas e perfis de acesso.' },
        { name: 'sectors', description: 'Setores públicos e administrativos.' },
        { name: 'surveys', description: 'Publicação de pesquisas e envio de respostas.' },
        { name: 'questions', description: 'Perguntas de avaliação.' },
        { name: 'settings', description: 'Configurações de notificação.' },
        { name: 'dashboard', description: 'Indicadores agregados.' },
        { name: 'complaints', description: 'Ocorrências associadas às respostas.' },
        { name: 'reports', description: 'Consulta paginada de respostas.' },
      ],
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
