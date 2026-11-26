# Padrões de banco de dados

## 1. Introdução

Este guia registra convenções encontradas nas migrations e no acesso SQL da API. O objetivo é facilitar leitura, manutenção e evolução coerente do esquema. Quando a convenção não é aplicada por ferramenta ou não aparece no código, fica marcada como recomendação.

## 2. Convenções de nomenclatura

| Elemento | Padrão observado | Exemplo real |
|---|---|---|
| Tabelas | minúsculas, `snake_case`, plural | `profiles`, `sector_managers`, `notification_jobs` |
| Colunas | minúsculas, `snake_case` | `created_at`, `password_hash`, `contact_consent` |
| PK | coluna `id` nas entidades; chave composta quando associativa | `profiles.id`, `sector_managers(profile_id, sector_id)` |
| FK | nome da entidade referenciada + `_id` | `survey_id`, `response_id`, `profile_id` |
| Índices | nomes descritivos, frequentemente `<tabela>_<colunas>_idx` ou `idx_<tabela>_<uso>` | `questions_active_sector_idx`, `idx_responses_created`, `surveys_one_published_per_sector` |
| Constraints | checks inline e nomes automáticos do PostgreSQL; nome explícito quando índice tem regra própria | `CHECK (value BETWEEN 1 AND 5)`, índice parcial `surveys_one_published_per_sector` |
| Enums | `snake_case` singular em nomes de tipo | `profile_role`, `survey_status`, `work_shift` |
| Relacionamentos | FKs declaradas no DDL; tabela associativa em N:N | `sector_managers` |
| Procedures/functions/triggers | não identificados nas migrations atuais | — |

Os nomes dos índices não seguem um único prefixo uniforme; manter clareza e consistência ao criar novos. Não foi identificado padrão de nomeação de triggers ou rotinas porque elas não existem no esquema versionado.

## 3. Tipos de dados

**Implementado:** UUID para identificadores; `smallint` para notas/valores limitados; `integer` para posição/tentativas; `boolean` para flags; `text`/`varchar(n)` para conteúdo; `text[]` para e-mails; `timestamptz` para instantes; enums PostgreSQL para papéis, estados, tipos e turnos. Campos opcionais são nullable. Os limites numéricos são reforçados com `CHECK` quando indicado na migration.

**Recomendação:** manter limites e significado alinhados entre Zod e SQL; explicitar nulabilidade deliberadamente; preferir `timestamptz` para instantes e não converter tipos sem migration revisada. UUIDs gerados pelo banco usam `gen_random_uuid()`.

## 4. Organização e consultas

O esquema fica em `database/migrations/`, separado do código TypeScript em `src/`. As migrations SQL são numeradas e aplicadas em ordem lexical; `schema_migrations` registra o nome aplicado. SQL da API fica em `src/models/`, usando parâmetros `$1`, `$2`, etc. Os serviços delimitam as transações com `src/utils/database.ts`, que garante commit/rollback e liberação do cliente.

**Recomendação:** continuar migrations incrementais e revisáveis; não editar migration já aplicada em ambientes compartilhados; criar índices guiados por consultas e medição; manter SQL parametrizado e ordenação explícita quando a API depende dela.

## 5. Boas práticas

**Observado no projeto:** FKs para as relações, constraints de domínio, índices para perguntas ativas, respostas por data/pesquisa, ocorrências e filas; índices parciais para perguntas ativas, pesquisas publicadas e jobs pendentes; unicidade em identificadores naturais/associações relevantes; parâmetros SQL.

**Recomendações futuras:** medir planos com `EXPLAIN (ANALYZE, BUFFERS)` em dados representativos antes de novos índices; acompanhar crescimento e custo de relatórios; aplicar paginação em consultas de listagem; revisar cardinalidades e retenção com a equipe. A rota pública de TV lê todas as notas NPS e avaliações e calcula agregados no processo, portanto pode exigir agregação/paginação no banco se o volume crescer. Isso é oportunidade de otimização, não gargalo medido.
