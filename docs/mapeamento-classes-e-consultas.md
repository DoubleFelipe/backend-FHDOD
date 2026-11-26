# Mapeamento de entidades e consultas

Atualizado em 26/11/2026. O projeto usa funções TypeScript e SQL parametrizado, sem ORM. O fluxo é frontend externo → routes/middlewares → controllers/validators → services → models → PostgreSQL.

## Persistência por recurso

| Arquivo | Dados e operações |
|---|---|
| `src/models/entities.ts` | Entidades, papéis e projeções tipadas de leitura |
| `src/models/auth.ts` | Perfil ativo, hash de senha e criação/rotação/revogação de sessões |
| `src/models/user.ts` | Listagem segura, criação de perfil e vínculos com setores |
| `src/models/access.ts` | Verificação parametrizada em `sector_managers` |
| `src/models/sector.ts` | Listagem global/atribuída/pública e criação |
| `src/models/survey.ts` | Publicação, pesquisa pública, chave idempotente, perguntas aplicáveis, resposta, avaliações, ocorrência e job |
| `src/models/question.ts` | Consulta global/por atribuição, criação e desativação lógica |
| `src/models/settings.ts` | Leitura e upsert do singleton de notificações |
| `src/models/metrics.ts` | Notas com filtros de setor, atendimento/submissão e turno; leitura pública sem dados pessoais |
| `src/models/complaint.ts` | Listagem paginada, setor de origem e atualização de status |
| `src/models/report.ts` | Respostas paginadas, respostas históricas e campos de Ouvidoria |
| `src/models/health.ts` | `SELECT 1` de readiness |
| `src/config/database.ts` | Pool `pg` e timeouts |
| `src/config/postgres-ssl.ts` | CA validada em produção e normalização das opções SSL |
| `src/utils/database.ts` | Cliente compartilhado; commit/rollback/liberação; descarte de conexão quebrada |

Os parâmetros são enviados separadamente do SQL, usando `$1`, `$2`, etc. Listas UUID usam arrays parametrizados e `ANY`/`unnest`; não são interpoladas. A autorização permanece nos serviços antes de operações administrativas e por setor; filtros SQL restringem leituras dos gestores.

## Transações

Criação de usuário e vínculos, rotação de refresh e submissão pública usam `transaction`. A submissão grava resposta, avaliações, ocorrência, tarefa e chave no mesmo cliente. Uma falha na tarefa reverte todas as gravações. O índice único da chave por pesquisa mantém a idempotência; repetições sequenciais são testadas, enquanto contenção entre conexões precisa de staging.

As migrations SQL existentes não foram alteradas. O executor continua em `src/scripts/migrate.ts` com `MIGRATION_DATABASE_URL`. O bootstrap administrativo permanece explícito em `src/scripts/create-admin.ts`; esses scripts operacionais não são rotas HTTP.

## Preservação do histórico e desempenho

Não há endpoint de exclusão física. `PATCH /questions/:id` desativa a pergunta, mantendo respostas e textos históricos. Relatórios e ocorrências usam paginação; perguntas e setores preservam a listagem existente. Indicadores ainda calculam sobre notas carregadas em memória: avaliar agregação SQL e índices com dados representativos antes de otimizar. Nenhum benchmark ou teste de carga foi realizado.

Ver [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [DATABASE.md](DATABASE.md) e [TESTING.md](TESTING.md).
