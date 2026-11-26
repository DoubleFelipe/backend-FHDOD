> **Estado atual: refatoração ausente dos fontes.** Durante a conferência final, os arquivos-fonte foram restaurados ao estado original e as novas pastas/testes desapareceram. O texto abaixo registra o trabalho e os testes executados antes dessa alteração; **não descreve uma entrega presente no checkout atual**. A reaplicação depende de esclarecer a intenção do usuário. Nenhum deploy foi realizado.

# Relatório da refatoração MVC — 26/11/2026

## Resultado e escopo

A refatoração foi implementada somente no backend, conforme a escolha expressa do usuário. As 25 operações HTTP e os formatos JSON de sucesso foram preservados; rotas, controllers, serviços, models, validações, middleware e configuração foram separados. Node.js, TypeScript, Fastify, PostgreSQL, Zod, JWT e Argon2id foram mantidos. A dependência nova PGlite é exclusiva de desenvolvimento/testes; nenhuma tecnologia do runtime foi substituída.

O diretório irmão `../FHDOD` foi consultado apenas para identificar a comunicação atual (Next.js, chamadas REST e cookies HttpOnly). Seus arquivos não foram alterados. O frontend continua externo, constituindo a camada de apresentação. Não houve alteração visual, importação de dados, migration em banco existente, exclusão de dados ou deploy. As migrations SQL e `render.yaml` permanecem inalterados.

## Alterações implementadas

- `app.ts` tornou-se o ponto de composição, com o prefixo `/api/v1` centralizado.
- Rotas e controllers foram organizados por saúde, autenticação, usuários, setores, pesquisas, perguntas, notificações, indicadores, ocorrências e relatórios.
- Services centralizam regras, permissões e transações; models contêm entidades, projeções tipadas e SQL parametrizado, com parâmetros tipados.
- Schemas Zod foram extraídos e reutilizados nos corpos, parâmetros e filtros da documentação OpenAPI.
- Autenticação agora consulta o perfil ativo e usa papel/troca de senha atuais, impedindo privilégios antigos após alteração do perfil. A troca obrigatória não depende mais da claim antiga do token.
- Verificação JWT restringe HS256 e exige identificação, expiração, emissão e JTI.
- Erros HTTP de JSON, mídia, corpo e rate limit preservam 400/415/413/429. Erros SQL de vínculo/check são 400, unicidade é 409; 404 também usa o envelope comum. Logs não serializam mensagens/detalhes SQL potencialmente pessoais.
- Conexões/transações compartilham helpers que garantem rollback e liberação, descartando conexão quebrada se o rollback falhar.
- A criação de usuário com setores, refresh e submissão continuam atômicos. Históricos, textos das perguntas, consentimento, jobs, data opcional e idempotência foram preservados.
- Validação também rejeita IDs de setor repetidos e intervalos com `from >= to`. Não foi introduzido novo limite agregado de texto: os limites existentes por campo, quantidade de respostas e corpo foram preservados.
- A documentação foi atualizada, incluindo permissões dos gestores que já existiam no código e estavam descritas de maneira incompleta.

## Estrutura final

```text
backend-FHDOD/
├── src/
│   ├── config/          Ambiente, banco, TLS e OpenAPI
│   ├── controllers/     Entrada/saída HTTP
│   ├── domain/          Erros e cálculos puros
│   ├── infrastructure/  JWT e hashing
│   ├── middlewares/     Autenticação e erros
│   ├── models/          Entidades e consultas parametrizadas
│   ├── routes/          Endpoints e políticas HTTP
│   ├── scripts/         Bootstrap e migrations
│   ├── services/        Negócio, autorização e transações
│   ├── utils/           Conexões e transações
│   ├── validators/      Schemas Zod
│   ├── app.ts
│   └── server.ts
├── tests/               HTTP, PostgreSQL em memória e unidades
├── database/migrations/ Migrations existentes, inalteradas
├── docs/
├── .env.example
├── package.json
├── render.yaml
├── tsconfig.json
├── tsconfig.test.json
└── README.md
```

A raiz permanece o backend para manter os comandos de execução e hospedagem. Estrutura detalhada: [ARCHITECTURE.md](ARCHITECTURE.md).

## Operações preservadas

Todos os caminhos abaixo recebem o prefixo `/api/v1`. Swagger permanece em `/api/docs` e `/api/docs/json`.

| Método | Caminho |
|---|---|
| GET | `/health/live` |
| GET | `/health/ready` |
| POST | `/auth/login` |
| POST | `/auth/refresh` |
| POST | `/auth/logout` |
| PATCH | `/auth/password` |
| GET | `/auth/me` |
| GET | `/users` |
| POST | `/users` |
| GET | `/sectors/public` |
| GET | `/sectors` |
| POST | `/sectors` |
| GET | `/surveys/public/:slug` |
| POST | `/surveys/public/:slug/responses` |
| POST | `/surveys` |
| GET | `/questions` |
| POST | `/questions` |
| PATCH | `/questions/:id` |
| GET | `/settings/notifications` |
| PUT | `/settings/notifications` |
| GET | `/dashboard/metrics` |
| GET | `/tv/metrics` |
| GET | `/complaints` |
| PATCH | `/complaints/:id` |
| GET | `/reports/responses` |

Nenhum endpoint destrutivo foi criado; desativação de perguntas usa PATCH, preservando histórico. Payloads, filtros, papéis e status estão em [API.md](API.md).

## Verificação executada

Ambiente: Windows, Node.js 24.14.0 e npm 11.9.0. Os testes usam dados fictícios e PostgreSQL efêmero em memória, sem conectar ao banco da aplicação.

| Comando | Resultado |
|---|---|
| `npm test` | 53 testes aprovados em 5 arquivos |
| `npm run typecheck` | Aprovado, incluindo testes |
| `npm run lint` | Aprovado |
| `npm run build` | Aprovado |

A suíte cobre todas as 25 operações, migrations e constraints, credenciais válidas/inválidas, refresh/logout/reuso, perfil inativo, papel alterado, senha provisória/troca, escopo dos gestores, provisionamento, consulta pública, submissão e repetição idempotente, falha na gravação de job com rollback completo, falha na rotação com preservação da sessão anterior, notificações, métricas, perguntas, ocorrências, relatórios, paginação, tentativa de SQL injection, CORS, Helmet, limites HTTP, rate limit e descarte de conexão quebrada.

A primeira instalação falhou por restrições ao cache/rede; a instalação autorizada das dependências concluiu. Durante os testes, uma expectativa incorreta sobre e-mail malformado foi corrigida de 401 para 400, e o tsconfig de testes passou a desabilitar geração de declarações para evitar erro de inferência dos mocks. As verificações finais acima passaram. Nenhum percentual de cobertura foi medido.

## Compatibilidade, deploy e rollback

`npm run dev`, `npm run build`, `npm start`, `npm run db:migrate`, `npm run admin:create` e o health check mantêm seus contratos. Não há DDL novo necessário para esta refatoração. Os caminhos de importação dos scripts foram ajustados à configuração centralizada. Antes de publicar, siga [MIGRATION.md](MIGRATION.md), configure segredos/CA/origens na plataforma, execute testes de staging e faça validação ponta a ponta com o frontend.

Como o schema não mudou, o rollback da refatoração consiste em restaurar a versão anterior do código. O processo regular de migrations existente deve ser revisado pelo operador antes de qualquer ação em produção. Nenhuma publicação foi realizada.

## Limitações e próximos passos

1. Executar staging com PostgreSQL nativo para validar rede/TLS, pool e concorrência de refresh/idempotência entre conexões. PGlite usa um adaptador e uma conexão e não comprova esses cenários.
2. Validar os fluxos reais do frontend e sua interface no repositório correspondente. O usuário optou por não refatorá-lo nesta tarefa.
3. Implementar worker/provedor de e-mail caso a entrega seja necessária. A persistência das tarefas foi mantida, mas não havia remetente implementado.
4. Medir carga e otimizar agregações de métricas no SQL conforme o volume. Atualmente as notas são carregadas para cálculo em memória.
5. Adotar rate limit compartilhado ao usar múltiplas instâncias; validar proxy, limites de pool, monitoramento e recuperação de backups no ambiente real.
6. Se for necessário invalidar imediatamente cada access token no logout, definir uma estratégia de sessão/blacklist. Hoje logout revoga refresh, e access segue TTL e verificação de perfil ativo.
7. Comparar esquema, identidades e dados legados antes de qualquer migração do Supabase. Essa importação não foi executada nem substituída por suposições.

## Inventário de arquivos

Inventário da refatoração preservada no stash `7d59419` do GitHub Desktop, comparado à sua base. No checkout atual, apenas este relatório está fora do Git; os fontes abaixo aguardam restauração. Os caminhos removidos foram realocados, sem remoção de funcionalidades.

### Criados (69)

- `docs/REFACTOR-PLAN.md`
- `docs/REFACTOR-REPORT.md`
- `src/config/database.ts`
- `src/config/index.ts`
- `src/config/openapi-schemas.ts`
- `src/config/openapi.ts`
- `src/config/postgres-ssl.ts`
- `src/controllers/auth.ts`
- `src/controllers/complaint.ts`
- `src/controllers/health.ts`
- `src/controllers/metrics.ts`
- `src/controllers/question.ts`
- `src/controllers/report.ts`
- `src/controllers/sector.ts`
- `src/controllers/settings.ts`
- `src/controllers/survey.ts`
- `src/controllers/user.ts`
- `src/middlewares/auth.ts`
- `src/middlewares/errors.ts`
- `src/models/access.ts`
- `src/models/auth.ts`
- `src/models/complaint.ts`
- `src/models/entities.ts`
- `src/models/health.ts`
- `src/models/metrics.ts`
- `src/models/question.ts`
- `src/models/report.ts`
- `src/models/sector.ts`
- `src/models/settings.ts`
- `src/models/survey.ts`
- `src/models/user.ts`
- `src/routes/auth.ts`
- `src/routes/complaint.ts`
- `src/routes/health.ts`
- `src/routes/index.ts`
- `src/routes/metrics.ts`
- `src/routes/question.ts`
- `src/routes/report.ts`
- `src/routes/sector.ts`
- `src/routes/settings.ts`
- `src/routes/survey.ts`
- `src/routes/user.ts`
- `src/services/auth.ts`
- `src/services/complaint.ts`
- `src/services/health.ts`
- `src/services/metrics.ts`
- `src/services/question.ts`
- `src/services/report.ts`
- `src/services/sector.ts`
- `src/services/settings.ts`
- `src/services/user.ts`
- `src/utils/database.ts`
- `src/validators/auth.ts`
- `src/validators/common.ts`
- `src/validators/complaint.ts`
- `src/validators/question.ts`
- `src/validators/report.ts`
- `src/validators/sector.ts`
- `src/validators/settings.ts`
- `src/validators/survey.ts`
- `src/validators/user.ts`
- `tests/api.integration.test.ts`
- `tests/app.test.ts`
- `tests/helpers/database.ts`
- `tests/http-security.test.ts`
- `tests/metrics.test.ts`
- `tests/setup.ts`
- `tests/transactions.test.ts`
- `tsconfig.test.json`


### Modificados (23)

- `README.md`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/arquitetura-backend.md`
- `docs/mapeamento-classes-e-consultas.md`
- `docs/padroes-banco-de-dados.md`
- `docs/plano-e-relatorio-de-testes.md`
- `docs/requisitos.md`
- `docs/seguranca-e-nuvem.md`
- `package-lock.json`
- `package.json`
- `src/app.ts`
- `src/domain/errors.ts`
- `src/domain/metrics.ts`
- `src/infrastructure/auth.ts`
- `src/scripts/create-admin.ts`
- `src/scripts/migrate.ts`
- `src/server.ts`
- `src/services/access.ts`
- `src/services/survey.ts`
- `vitest.config.ts`


### Removidos dos caminhos antigos (5)

- `src/app.test.ts`
- `src/config.ts`
- `src/domain/metrics.test.ts`
- `src/infrastructure/database.ts`
- `src/infrastructure/postgres-ssl.ts`

### Realocações principais

| Caminho anterior | Novo caminho |
|---|---|
| `src/config.ts` | `src/config/index.ts` |
| `src/infrastructure/database.ts` | `src/config/database.ts` |
| `src/infrastructure/postgres-ssl.ts` | `src/config/postgres-ssl.ts` |
| `src/app.test.ts` | `tests/app.test.ts` |
| `src/domain/metrics.test.ts` | `tests/metrics.test.ts` |
