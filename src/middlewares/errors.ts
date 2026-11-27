import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../domain/errors.js';

export function registerErrors(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send({ error: { code: 'NOT_FOUND', message: 'Resource not found', requestId: request.id } }),
  );
  app.setErrorHandler((error, request, reply) => {
    const send = (status: number, code: string, message: string) =>
      reply.code(status).send({ error: { code, message, requestId: request.id } });
    if (error instanceof z.ZodError) return send(400, 'VALIDATION_ERROR', 'Invalid request');
    if (error instanceof AppError) return send(error.statusCode, error.code, error.message);
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === '23505') return send(409, 'CONFLICT', 'Resource already exists');
    if (['23503', '23514', '22P02', '22007', '22008'].includes(code))
      return send(400, 'VALIDATION_ERROR', 'Invalid resource data');
    const status =
      error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (status === 429) return send(429, 'RATE_LIMITED', 'Too many requests');
    if (status === 413) return send(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    if (status === 415) return send(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type');
    if (status >= 400 && status < 500) return send(status, 'BAD_REQUEST', 'Invalid request');
    // PostgreSQL errors may contain submitted email/contact values in detail/message.
    request.log.error({ errorCode: code || 'UNKNOWN', requestId: request.id }, 'request failed');
    return send(500, 'INTERNAL_ERROR', 'Internal server error');
  });
}
