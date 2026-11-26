import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPublicSurvey, submitResponse, publish as publishSurvey } from '../services/survey.js';
import { id, slugParams } from '../validators/common.js';
import { responseSchema, surveySchema } from '../validators/survey.js';
import { principalOf } from '../middlewares/auth.js';
export async function publicSurvey(request: FastifyRequest) {
  return getPublicSurvey(slugParams.parse(request.params).slug);
}
export async function submit(request: FastifyRequest, reply: FastifyReply) {
  const slug = slugParams.parse(request.params).slug;
  const key = id.parse(request.headers['idempotency-key']);
  const result = await submitResponse(slug, key, responseSchema.parse(request.body));
  return reply.code(result.repeated ? 200 : 201).send(result);
}
export async function publish(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .code(201)
    .send(await publishSurvey(principalOf(request), surveySchema.parse(request.body)));
}
