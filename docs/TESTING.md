# Testes

Execute `npm test`, `npm run lint`, `npm run typecheck` e `npm run build`. Os testes unitários cobrem NPS, médias, satisfação e faixas de plantão em São Paulo. Testes HTTP por injeção Fastify cobrem liveness, validação de chave idempotente ausente e Swagger UI sem banco externo.

Testes de integração com banco e migrations ainda não estão habilitados. Ao implementá-los, exija `TEST_DATABASE_URL` dedicado, recuse `NODE_ENV=production` e hosts de produção, e use banco/schema isolado. Nunca aponte testes às credenciais de runtime ou migration de produção. `npm run db:migrate` usa `MIGRATION_DATABASE_URL`; aplique somente em banco local descartável ou staging, salvo decisão explícita de aplicar DDL em produção.
