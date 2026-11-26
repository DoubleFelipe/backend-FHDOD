import type { FastifyReply, FastifyRequest } from 'fastify';
import * as service from '../services/user.js';
import { userSchema } from '../validators/user.js';
import { principalOf } from '../middlewares/auth.js';
export async function list(request: FastifyRequest) {
  return service.list(principalOf(request));
}
export async function create(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .code(201)
    .send(await service.create(principalOf(request), userSchema.parse(request.body)));
}
