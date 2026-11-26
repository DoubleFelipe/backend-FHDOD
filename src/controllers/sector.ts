import type { FastifyReply, FastifyRequest } from 'fastify';
import * as service from '../services/sector.js';
import { sectorQuery } from '../validators/common.js';
import { sectorSchema } from '../validators/sector.js';
import { principalOf } from '../middlewares/auth.js';
export async function list(request: FastifyRequest) {
  return service.list(principalOf(request), sectorQuery.parse(request.query).sectorId);
}
export async function publicSectors() {
  return service.publicSectors();
}
export async function create(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .code(201)
    .send(await service.create(principalOf(request), sectorSchema.parse(request.body)));
}
