import type { FastifyRequest } from 'fastify';
import type { Principal } from '../infrastructure/auth.js';
import { forbidden, unauthorized } from '../domain/errors.js';
import { authenticateToken } from '../services/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export async function authenticate(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  request.principal = await authenticateToken(header.slice(7));
}

export async function requirePanel(request: FastifyRequest) {
  await authenticate(request);
  if (principalOf(request).mustChangePassword) throw forbidden();
}

export function principalOf(request: FastifyRequest): Principal {
  if (!request.principal) throw unauthorized();
  return request.principal;
}
