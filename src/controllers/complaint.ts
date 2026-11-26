import type { FastifyRequest } from 'fastify';
import * as service from '../services/complaint.js';
import { complaintQuery, complaintSchema } from '../validators/complaint.js';
import { idParams } from '../validators/common.js';
import { principalOf } from '../middlewares/auth.js';
export async function list(request: FastifyRequest) {
  return service.list(principalOf(request), complaintQuery.parse(request.query));
}
export async function update(request: FastifyRequest) {
  return service.update(
    principalOf(request),
    idParams.parse(request.params).id,
    complaintSchema.parse(request.body),
  );
}
