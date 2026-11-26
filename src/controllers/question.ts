import type { FastifyReply, FastifyRequest } from 'fastify';
import * as service from '../services/question.js';
import { idParams } from '../validators/common.js';
import { deactivateSchema, questionSchema } from '../validators/question.js';
import { principalOf } from '../middlewares/auth.js';
export async function list(request: FastifyRequest) {
  return service.list(principalOf(request));
}
export async function create(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .code(201)
    .send(await service.create(principalOf(request), questionSchema.parse(request.body)));
}
export async function deactivate(request: FastifyRequest) {
  const { id } = idParams.parse(request.params);
  deactivateSchema.parse(request.body);
  return service.deactivate(principalOf(request), id);
}
