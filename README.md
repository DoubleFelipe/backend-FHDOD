# API FHDOD — Pesquisa de Satisfação

Backend REST em TypeScript para pesquisas de satisfação do FHDOD. Expõe pesquisa pública e submissão de respostas, autenticação e administração de contas, gestão de setores e perguntas, indicadores, ocorrências e relatórios. Este repositório contém a API; o frontend não está incluído neste checkout.

## Funcionalidades

- Publicação e consulta pública de pesquisas e perguntas ativas.
- Submissão idempotente de respostas NPS e avaliações, com possibilidade de ocorrência e consentimento para contato.
- Login, rotação e revogação de sessão, troca de senha e perfis de acesso.
- Administração de usuários, setores, pesquisas, perguntas e configuração de notificações.
- Indicadores agregados, lista paginada de respostas e gestão de ocorrências.
- Verificações de saúde e documentação OpenAPI/Swagger.

O envio efetivo de e-mails e uma interface frontend não estão implementados neste repositório. Tarefas de notificação são persistidas no banco, sem worker/provedor de e-mail identificado.

## Tecnologias e arquitetura

Node.js 22+, TypeScript estrito, Fastify 5, PostgreSQL via `pg`, Zod, JWT com `jose`, hash Argon2id, plugins Fastify de CORS/Helmet/limite de requisições, Swagger/OpenAPI, Vitest, ESLint e Prettier. A API usa MVC adaptado a REST: rotas → controllers → services → models → PostgreSQL. A apresentação pertence ao frontend externo. Os contratos JSON existentes e as 25 operações sob `/api/v1` foram preservados.

```text
src/
  config/           Ambiente validado, PostgreSQL, TLS e OpenAPI
  controllers/      Entrada HTTP, schemas e códigos de resposta
  domain/           Erros e cálculos puros
  infrastructure/   JWT e hashing
  middlewares/      Autenticação, bloqueio por senha e erros HTTP
  models/           Entidades tipadas e SQL parametrizado por recurso
  routes/           Registro de endpoints e políticas HTTP
  scripts/          Criação controlada de admin e migrations
  services/         Regras de negócio, autorização e transações
  utils/            Ciclo de vida de conexão e transação
  validators/       Schemas Zod e tipos de entrada compartilhados
  app.ts            Composição de plugins, middleware e rotas
  server.ts         Inicialização e encerramento
tests/               HTTP, integração PostgreSQL isolada e testes unitários
database/migrations/ Esquema versionado
docs/                Documentação técnica e operacional
```

## Pré-requisitos

- Node.js 22 ou superior e npm.
- PostgreSQL 15 ou superior, local ou ambiente de desenvolvimento isolado.

## Instalação e configuração

```powershell
npm ci
Copy-Item .env.example .env
```

Edite `.env` localmente. Configure `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `ACCESS_TOKEN_SECRET` e `REFRESH_TOKEN_SECRET` com valores apropriados. Os segredos devem ser distintos e ter ao menos 32 caracteres. Em desenvolvimento local, `.env.example` usa `sslmode=disable`; produção exige certificado CA confiável e `MIGRATION_DATABASE_URL`. Nunca versione o arquivo `.env` ou credenciais reais.

Variáveis e valores padrão ficam em [`.env.example`](.env.example) e são validados em `src/config/`. A configuração inclui host/porta, URLs de banco, CA TLS, pool/timeouts, segredos e duração de tokens, origens CORS, limites de requisição/submissão e nível de log.

| Grupo | Variáveis |
|---|---|
| Servidor | `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL` |
| Banco | `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `DATABASE_CA_CERT` ou `DATABASE_CA_CERT_PATH` |
| Pool e timeouts | `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS`, `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_STATEMENT_TIMEOUT_MS` |
| Autenticação | `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS` |
| CORS e limites | `CORS_ORIGINS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_MAX`, `PUBLIC_SUBMISSION_RATE_LIMIT_MAX` |
| Submissões | `PUBLIC_SUBMISSION_MAX_FIELDS`, `PUBLIC_SUBMISSION_MAX_TEXT_LENGTH` |
| Provisionamento temporário | `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, `ADMIN_PASSWORD` |

## Banco de dados e primeiro administrador

Crie um banco PostgreSQL vazio para desenvolvimento e aplique as migrations:

```powershell
npm run db:migrate
```

Para criar o primeiro administrador, defina temporariamente `ADMIN_EMAIL`, `ADMIN_FULL_NAME` e `ADMIN_PASSWORD` no ambiente local/gerenciador de segredos e rode `npm run admin:create`. A senha exige 12 a 200 caracteres; o script não a imprime nem imprime seu hash. Remova as variáveis temporárias após o uso. O executor de migrations utiliza a credencial separada `MIGRATION_DATABASE_URL`.

## Execução local e endereços

```powershell
npm run dev
```

Com a configuração padrão, a API escuta em `http://localhost:3001`. Documentação interativa: `http://localhost:3001/api/docs`; JSON OpenAPI: `http://localhost:3001/api/docs/json`. Verificações: `/api/v1/health/live` e `/api/v1/health/ready`. As URLs de produção informadas são [frontend](https://fhdod.vercel.app/) e [API](https://backend-fhdod.onrender.com/).

## Scripts

| Comando | Finalidade |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com recarga |
| `npm run build` | Compila TypeScript em `dist/` |
| `npm start` | Inicia a versão compilada |
| `npm run typecheck` | Verifica tipos sem gerar saída |
| `npm run lint` | Executa ESLint |
| `npm test` | Executa testes Vitest |
| `npm run db:migrate` | Aplica migrations pendentes |
| `npm run admin:create` | Provisiona primeiro administrador |

## Documentação do Projeto

- [Requisitos](docs/requisitos.md)
- [Arquitetura do backend](docs/arquitetura-backend.md)
- [Padrões Git e contribuição](docs/padroes-git.md)
- [Plano e relatório de testes](docs/plano-e-relatorio-de-testes.md)
- [Referência de endpoints](docs/API.md)
- [Arquitetura MVC](docs/ARCHITECTURE.md)
- [Plano de refatoração e compatibilidade](docs/REFACTOR-PLAN.md)
- [Relatório da refatoração](docs/REFACTOR-REPORT.md)
- [Testes e suas limitações](docs/TESTING.md)
- [Modelo de dados](docs/DATABASE.md)
- [Modelo de dados e requisitos](docs/modelo-de-dados-e-requisitos.md)
- [Padrões de banco de dados](docs/padroes-banco-de-dados.md)
- [Mapeamento de classes e consultas](docs/mapeamento-classes-e-consultas.md)
- [Segurança e nuvem](docs/seguranca-e-nuvem.md)
- [Segurança](docs/SECURITY.md)
- [Migração](docs/MIGRATION.md)

**Documentação online:** disponível em `http://localhost:3001/api/docs` localmente e em [`https://backend-fhdod.onrender.com/api/docs`](https://backend-fhdod.onrender.com/api/docs) na implantação informada.

## Endpoints e integração

Todas as rotas de negócio usam o prefixo `/api/v1`:

| Recurso | Operações |
|---|---|
| Saúde | `GET /health/live`, `GET /health/ready` |
| Autenticação | `POST /auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me`; `PATCH /auth/password` |
| Usuários | `GET /users`, `POST /users` |
| Setores | `GET /sectors/public`; `GET /sectors`, `POST /sectors` |
| Pesquisas | `GET /surveys/public/:slug`; `POST /surveys/public/:slug/responses`; `POST /surveys` |
| Perguntas | `GET /questions`, `POST /questions`, `PATCH /questions/:id` |
| Notificações | `GET /settings/notifications`, `PUT /settings/notifications` |
| Indicadores | `GET /dashboard/metrics`, `GET /tv/metrics` |
| Ocorrências | `GET /complaints`, `PATCH /complaints/:id` |
| Relatórios | `GET /reports/responses` |

Payloads, filtros e permissões estão em [docs/API.md](docs/API.md). Os sucessos mantêm os objetos/listas existentes; erros usam `{error:{code,message,requestId}}`. Não há exclusão física via API; perguntas são desativadas por PATCH para preservar histórico.

O frontend deve centralizar as chamadas HTTP à base `/api/v1`, enviar bearer nas rotas privadas e UUID `Idempotency-Key` nas submissões, tratar 204 sem ler JSON, preservar a chave e os dados do formulário ao repetir envios e apresentar estados de carregamento/erro/sucesso. Nunca inclua URLs de banco ou segredos JWT no cliente. A leitura dos contratos do frontend irmão confirmou os formatos esperados; **nenhum arquivo do frontend foi alterado**, conforme o escopo solicitado.

## Validação local

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

A suíte aplica as migrations SQL reais em PostgreSQL em memória com PGlite, somente como dependência de desenvolvimento. Não exige Docker, banco de testes externo ou credenciais reais. Testes de HTTP também verificam CORS, JWT, permissões, erros e rate limit. Limitações de concorrência, rede/TLS e ambiente de produção estão descritas em [docs/TESTING.md](docs/TESTING.md).

## Publicação

`render.yaml` contém uma configuração de serviço web Node no Render, incluindo build, migration no pre-deploy, comando de inicialização e health check. A URL pública informada para a API é [`https://backend-fhdod.onrender.com/`](https://backend-fhdod.onrender.com/); a URL informada para o frontend é [`https://fhdod.vercel.app/`](https://fhdod.vercel.app/). Os endereços foram fornecidos pelo responsável; disponibilidade, variáveis/segredos, certificado CA Aiven e estado do banco não foram verificados neste ambiente. Consulte [docs/MIGRATION.md](docs/MIGRATION.md) antes de qualquer migração de dados ou cutover. O SQL legado do Supabase não está neste checkout e esta aplicação não importa identidades nem dados.
