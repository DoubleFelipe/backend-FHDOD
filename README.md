# API FHDOD — Pesquisa de Satisfação

Backend REST independente para a aplicação FHDOD. Tecnologias: Node.js 22+, TypeScript estrito, Fastify, PostgreSQL (`pg`), Zod e OpenAPI 3.1.

## Passo a passo para executar localmente

### Pré-requisitos

- Node.js 22 ou superior e npm.
- PostgreSQL 15 ou superior em execução local. Ainda não há conexão Aiven configurada.

### Instalação e configuração

1. Abra um terminal na pasta do repositório.
2. Instale dependências: `npm ci`.
3. Copie `.env.example` para `.env`.
4. No `.env`, configure `DATABASE_URL` e `MIGRATION_DATABASE_URL` apontando para o banco local. Para desenvolvimento local, o exemplo usa `sslmode=disable`.
5. Gere dois segredos diferentes com pelo menos 32 caracteres e defina `ACCESS_TOKEN_SECRET` e `REFRESH_TOKEN_SECRET`. Mantenha `NODE_ENV=development` e ajuste `CORS_ORIGINS` para a origem do frontend (padrão `http://localhost:3000`).
6. Crie o banco PostgreSQL vazio antes de aplicar o esquema.

### Banco e primeiro administrador

7. Aplique as migrations: `npm run db:migrate`.
8. Defina temporariamente `ADMIN_EMAIL`, `ADMIN_FULL_NAME` e `ADMIN_PASSWORD` no `.env`. A senha precisa ter pelo menos 12 caracteres.
9. Crie o administrador: `npm run admin:create`. O comando não imprime a senha nem o hash; remova as variáveis temporárias depois.

### Iniciar e conferir

10. Inicie a API: `npm run dev` (por padrão, `http://localhost:3001`).
11. Abra `http://localhost:3001/api/docs` para a interface Swagger. A especificação JSON está em `http://localhost:3001/api/docs/json`.
12. Confira `http://localhost:3001/api/v1/health/live` e `http://localhost:3001/api/v1/health/ready`.

Para encerrar o servidor, pressione `Ctrl+C` no terminal.

Provision the first administrator through `npm run admin:create` with `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, and `ADMIN_PASSWORD` supplied through a secure local environment or secret manager. The script does not print the password or hash.

O esquema legado indicado (`supabase/migrations/202610020001_initial_schema.sql`) não existe neste checkout. O modelo inicial e as decisões/itens que precisam de confirmação estão em `docs/`.

## Comandos úteis

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — compilação TypeScript
- `npm run start` — servidor compilado
- `npm run lint` / `npm run typecheck`
- `npm test` — testes unitários e HTTP sem banco externo
- `npm run db:migrate` — migrations (apenas com conexão de migration configurada)

Veja [docs/MIGRATION.md](docs/MIGRATION.md) antes de migrar dados ou realizar cutover. Esta implementação não se conecta à Aiven por padrão, não migra identidades e não importa dados. Em produção, configure `DATABASE_CA_CERT_PATH` com a CA da Aiven e use segredos de um gerenciador seguro; não use `sslmode=disable`.
