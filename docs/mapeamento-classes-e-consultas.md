# Mapeamento de classes e consultas

## 1. Introdução

Este documento descreve o caminho real da persistência entre os handlers HTTP e PostgreSQL. O repositório contém somente a API; o cliente/frontend não está incluído.

## 2. Arquitetura de persistência

```text
Cliente HTTP (frontend não incluído)
  → rotas/validação e handlers em src/app.ts (Fastify + Zod)
  → src/services/survey.ts / src/services/access.ts quando aplicável
  → pool PostgreSQL (src/infrastructure/database.ts; pacote pg)
  → PostgreSQL
```

Não foram encontrados models ORM, repositórios ou DAOs separados. Consultas também são executadas diretamente por handlers em `src/app.ts`. Regras de negócio transacionais ficam principalmente em `src/services/survey.ts` e em handlers de criação/autenticação.

## 3. Arquivos de persistência

| Arquivo/Classe | Responsabilidade | Operações realizadas | Entidades envolvidas |
|---|---|---|---|
| `src/config.ts` | Lê `.env` e valida configuração | Validação Zod de URLs, CA, pool, timeouts e segredos | Configuração |
| `src/infrastructure/database.ts` | Cria `pg.Pool` | Pool e timeout de statement/conexão | Todas |
| `src/infrastructure/postgres-ssl.ts` | Configura SSL PostgreSQL | Lê CA de variável ou caminho em produção; rejeita certificado inválido | Conexão |
| `src/scripts/migrate.ts` | Executor de migrations | Cria `schema_migrations`, aplica SQL pendente em transação | Esquema |
| `database/migrations/001_initial.sql` | Esquema inicial | DDL de tabelas, enums, constraints e índices | Todas exceto `attended_at`/role ombudsman |
| `database/migrations/002_client_confirmed_requirements.sql` | Evolução do esquema | Adiciona role `ombudsman`, `attended_at`, torna `shift` nullable | `profiles`, `responses` |
| `src/services/survey.ts` | Consulta pesquisa e grava submissão atômica/idempotente | SELECT, INSERT, UPDATE, transação | surveys, sectors, questions, submission_keys, responses, answers, complaints, notification_jobs |
| `src/services/access.ts` | Verifica autorização de setor | SELECT parametrizado | sector_managers |
| `src/app.ts` | Rotas, autorização, validação, operações CRUD e relatórios | SELECT/INSERT/UPDATE; cliente/pool | profiles, refresh_sessions, sectors, surveys, questions, app_settings, responses, answers, complaints e relações |
| `src/infrastructure/auth.ts` | JWT, hashes de senha/tokens e sessões | Helpers criptográficos; persistência de sessões é chamada pelas rotas | profiles, refresh_sessions |
| `src/scripts/create-admin.ts` | Provisiona administrador inicial | INSERT transacional/SQL parametrizado | profiles |

### Conexão e erros

`src/config.ts` carrega `dotenv/config`; configuração ausente/inválida encerra a inicialização sem imprimir valores, apenas chaves com erro. `DATABASE_URL` configura pool runtime. `MIGRATION_DATABASE_URL` é exigida pelo executor; em produção também é obrigatória pela validação. O TLS de produção usa CA confiável (`DATABASE_CA_CERT` ou `DATABASE_CA_CERT_PATH`) com `rejectUnauthorized: true`. As rotas traduzem erros conhecidos por `AppError`; erro inesperado recebe resposta genérica e não expõe stack em produção. Transações fazem rollback em erro e liberam clientes em `finally`.

## 4. Consultas e operações representativas

Trechos abaixo são reduzidos a partir do código; parâmetros são enviados separadamente pelo driver `pg`.

| Finalidade | Arquivo/rota | Operação e parâmetros/filtros | Entidades |
|---|---|---|---|
| Obter pesquisa pública | `src/services/survey.ts`, `getPublicSurvey` | SELECT com `JOIN sectors`, `LEFT JOIN questions`; filtro slug, setor ativo e pesquisa publicada; JSON agregado por posição | surveys, sectors, questions |
| Registrar submissão | `src/services/survey.ts`, `submitResponse` | Transação: reserva chave com `ON CONFLICT DO NOTHING`, valida pesquisa/perguntas, INSERT response/answers/complaint/job, UPDATE chave | surveys, submission_keys, questions, responses, answers, complaints, notification_jobs |
| Consultar indicadores | `src/app.ts`, `/dashboard/metrics` | SELECT com filtros opcionais setor, intervalo (`attended_at` ou `created_at`) e turno; joins survey/sector; segunda consulta agrega notas via JOIN | responses, surveys, sectors, answers, questions, sector_managers |
| Listar ocorrências | `src/app.ts`, `/complaints` | SELECT com joins resposta/pesquisa, filtros de setor/status, ordenação `created_at DESC`, `LIMIT/OFFSET` | complaints, responses, surveys, sector_managers |
| Relatório paginado | `src/app.ts`, `/reports/responses` | SELECT com joins, subconsulta JSON de answers e reclamação, filtros de setor/período/turno, ordem recente e paginação | responses, surveys, sectors, answers, complaints |
| Atualizar status de ocorrência | `src/app.ts`, `PATCH /complaints/:id` | SELECT para obter setor/autorização; UPDATE status e `updated_at` | complaints, responses, surveys |
| Configuração de notificações | `src/app.ts`, `/settings/notifications` | SELECT singleton; INSERT/UPSERT (`ON CONFLICT`) com e-mails/flag | app_settings |

Exemplos reais:

```sql
SELECT sv.id AS survey_id, sv.title, s.name AS sector_name
FROM surveys sv JOIN sectors s ON s.id = sv.sector_id
WHERE s.slug = $1 AND s.active = true AND sv.status = 'published';
```

```sql
INSERT INTO submission_keys (survey_id, submission_id, session_hash)
VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING submission_id;
```

```sql
UPDATE complaints SET status = $2, updated_at = now()
WHERE id = $1 RETURNING id, status, updated_at;
```

**Segurança:** valores externos são validados por Zod e vinculados como parâmetros `$n`. Valores enumerados/operadores da consulta são constantes de código; queries dinâmicas interpolam apenas trechos SQL fixos. Autorização por função e setor é verificada nos handlers/serviço. Isso reduz risco de SQL injection nas consultas observadas; não substitui revisão de autorização/validação.

## 5. Operações CRUD

- **Create:** contas (incluindo bootstrap admin), setores, pesquisas, perguntas, respostas, avaliações, ocorrências, jobs e configurações.
- **Read:** autenticação/perfil, setores/perguntas/pesquisa pública, configurações, indicadores, ocorrências e respostas paginadas.
- **Update:** senha e sessão, ativação de pergunta (soft deactivation), configuração de notificações e status de ocorrência; chave de submissão recebe `response_id` durante a transação.
- **Delete:** não há rota de exclusão CRUD identificada. O esquema restringe remoções referenciadas; sessão associada ao perfil tem cascata no banco.

## 6. Desempenho

Índices comprovados estão em `database/migrations/001_initial.sql`: perguntas ativas por setor/posição; respostas por pesquisa/data e data; ocorrências por status/data; chaves por hash/data; fila de jobs pendentes; sessões ativas por perfil; além de PKs, FKs únicos/índice parcial da pesquisa publicada.

O endpoint `/tv/metrics` lê todas as linhas de NPS e avaliações e calcula estatísticas em memória; se os dados crescerem, agregação SQL e medição são oportunidades. Indicadores também transferem valores para cálculo na aplicação. Não há métricas de volume, EXPLAIN ou benchmark neste checkout; portanto não se afirma gargalo confirmado. A paginação dos relatórios/ocorrências limita o volume retornado.
