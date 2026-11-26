import type { FastifyReply, FastifyRequest } from 'fastify';
import * as service from '../services/auth.js';
import { loginSchema, passwordSchema, refreshSchema } from '../validators/auth.js';
import { principalOf } from '../middlewares/auth.js';

export async function login(request: FastifyRequest) {
  return service.login(loginSchema.parse(request.body));
}
export async function refresh(request: FastifyRequest) {
  return service.refresh(refreshSchema.parse(request.body).refreshToken);
}
export async function logout(request: FastifyRequest, reply: FastifyReply) {
  await service.logout(refreshSchema.parse(request.body).refreshToken);
  return reply.code(204).send();
}
export async function changePassword(request: FastifyRequest, reply: FastifyReply) {
  await service.changePassword(principalOf(request), passwordSchema.parse(request.body));
  return reply.code(204).send();
}
export async function me(request: FastifyRequest) {
  return service.me(principalOf(request));
}
