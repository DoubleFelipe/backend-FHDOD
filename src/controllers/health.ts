import type { FastifyReply, FastifyRequest } from 'fastify';
import { isReady } from '../services/health.js';
export async function live() {
  return { status: 'ok' };
}
export async function ready(_request: FastifyRequest, reply: FastifyReply) {
  return (await isReady()) ? { status: 'ready' } : reply.code(503).send({ status: 'unavailable' });
}
