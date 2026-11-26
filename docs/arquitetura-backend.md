# Arquitetura do backend

Atualizado em 26/11/2026 após a refatoração MVC. A descrição anterior de handlers com SQL em `src/app.ts` foi substituída pela arquitetura implementada em [ARCHITECTURE.md](ARCHITECTURE.md).

## Organização atual

```text
src/app.ts                         Composição da API
src/server.ts                      Inicialização e encerramento
src/config/                        Ambiente, PostgreSQL, TLS e OpenAPI
src/routes/{recurso}.ts             Caminhos e políticas HTTP
src/middlewares/                    Autenticação e erros
src/controllers/{recurso}.ts        Validação de transporte e resposta HTTP
src/validators/{recurso}.ts         Schemas de entrada e tipos
src/services/{recurso}.ts           Regras, autorização e transações
src/models/{recurso}.ts             SQL parametrizado
src/models/entities.ts             Entidades e projeções de leitura
src/utils/database.ts              Conexões e transações
src/infrastructure/auth.ts         JWT e hashing
src/domain/                        Erros e cálculos
src/scripts/                       Bootstrap e migrations
tests/                             HTTP, SQL isolado e unidades
database/migrations/               Esquema existente, preservado
```

## Decisões

- Fastify, TypeScript e `pg` foram mantidos; não foi introduzido ORM.
- Há módulos para saúde, autenticação, usuários, setores, pesquisas, perguntas, notificações, indicadores, ocorrências e relatórios.
- O frontend constitui a apresentação. Por solicitação do usuário, apenas este backend foi alterado.
- URLs `/api/v1`, campos JSON, status de sucesso e comandos do Render foram preservados.
- Models recebem o mesmo cliente nas transações; controllers não acessam o pool.
- Dados e identidades existentes não foram migrados, excluídos ou convertidos.
- As validações Zod são reutilizadas para documentar corpos, paths e filtros no OpenAPI.

Veja [API.md](API.md) para as 25 operações e permissões, [mapeamento de consultas](mapeamento-classes-e-consultas.md) para persistência e [REFACTOR-REPORT.md](REFACTOR-REPORT.md) para evidências e limitações.
