import type { FastifyReply, FastifyRequest } from 'fastify';
import * as service from '../services/survey.js';
import { id, idParams, slugParams } from '../validators/common.js';
import { responseSchema, surveySchema } from '../validators/survey.js';
import { principalOf } from '../middlewares/auth.js';
export async function publicSurvey(request: FastifyRequest) {
  return service.getPublicSurvey(slugParams.parse(request.params).slug);
}
export async function submit(request: FastifyRequest, reply: FastifyReply) {
  const slug = slugParams.parse(request.params).slug;
  const key = id.parse(request.headers['idempotency-key']);
  const result = await service.submitResponse(slug, key, responseSchema.parse(request.body));
  return reply.code(result.repeated ? 200 : 201).send(result);
}
export async function publish(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .code(201)
    .send(await service.publish(principalOf(request), surveySchema.parse(request.body)));
}
export async function list(request: FastifyRequest) {
  return service.list(principalOf(request));
}
export async function archive(request: FastifyRequest, reply: FastifyReply) {
  await service.archive(principalOf(request), idParams.parse(request.params).id);
  return reply.code(204).send();
}
