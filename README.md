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

Node.js 22+, TypeScript estrito, Fastify 5, PostgreSQL via `pg`, Zod, JWT com `jose`, hash Argon2id, plugins Fastify de CORS/Helmet/limite de requisições, Swagger/OpenAPI, Vitest, ESLint e Prettier. As rotas ficam em `src/app.ts`; `src/services/` concentra regras e transações, `src/domain/` os cálculos e erros, e `src/infrastructure/` integrações e acesso ao banco. Migrations SQL estão em `database/migrations/`.

```text
src/
  domain/           Erros e métricas
  infrastructure/   Autenticação, pool PostgreSQL e TLS
  scripts/          Criação controlada de admin e migrations
  services/         Acesso por setor e submissão/consulta de pesquisas
  app.ts            Plugins e rotas HTTP
  server.ts         Inicialização e encerramento gracioso
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

Variáveis, validações e valores padrão ficam em [`.env.example`](.env.example) e `src/config.ts`. A configuração inclui host/porta, URLs de banco, CA TLS, pool/timeouts, segredos e duração de tokens, origens CORS, limites de requisição/submissão e nível de log.

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

Com a configuração padrão, a API escuta em `http://localhost:3001`. Documentação interativa: `http://localhost:3001/api/docs`; JSON OpenAPI: `http://localhost:3001/api/docs/json`. Verificações: `/api/v1/health/live` e `/api/v1/health/ready`. Endereço de produção não confirmado neste checkout.

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
- [Modelo de dados](docs/DATABASE.md)
- [Modelo de dados e requisitos](docs/modelo-de-dados-e-requisitos.md)
- [Padrões de banco de dados](docs/padroes-banco-de-dados.md)
- [Mapeamento de classes e consultas](docs/mapeamento-classes-e-consultas.md)
- [Segurança e nuvem](docs/seguranca-e-nuvem.md)
- [Contribuições individuais de banco de dados](docs/contribuicoes-banco-de-dados.md)
- [Pitch técnico de banco de dados](docs/pitch-banco-de-dados.md)
- [Segurança](docs/SECURITY.md)
- [Migração](docs/MIGRATION.md)

**Documentação Online da API:** disponível localmente em `http://localhost:3001/api/docs` quando a API está em execução. URL pública: [PREENCHER: URL publicada, se houver].

## Publicação

`render.yaml` contém uma configuração de serviço web Node no Render, incluindo build, migration no pre-deploy, comando de inicialização e health check. Isso é uma configuração versionada, não evidência de serviço publicado. Para produção, configure variáveis/segredos e certificado CA Aiven de forma segura. Consulte [docs/MIGRATION.md](docs/MIGRATION.md) antes de qualquer migração de dados ou cutover. O SQL legado do Supabase não está neste checkout e esta aplicação não importa identidades nem dados.
