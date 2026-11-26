# Testes e validação da refatoração

## Execução

```powershell
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

O Vitest lê `tests/**/*.test.ts`. `tests/setup.ts` define ambiente e segredos fictícios; a URL runtime de teste aponta para uma porta sem banco e não é usada para integração. `tests/helpers/database.ts` adapta somente o transporte `pg` para um PostgreSQL efêmero em memória com [PGlite](https://pglite.dev/docs/api). Os models e seu SQL são executados de verdade. As duas migrations são lidas do repositório e aplicadas em transações nessa instância descartável. Não são usadas credenciais externas, banco de produção ou Docker.

## Cobertura funcional

| Arquivo | Verificações |
|---|---|
| `tests/app.test.ts` | Liveness, chave idempotente e Swagger/OpenAPI |
| `tests/api.integration.test.ts` | Todas as 25 operações; migrations, constraints, Argon2/JWT, refresh, logout, senha, papéis/setores, dados públicos, usuários, submissão e rollback, perguntas, notificações, métricas, ocorrências, relatórios e erros |
| `tests/http-security.test.ts` | Autenticação de todas as rotas privadas, JWT inválido, CORS/preflight, Helmet, JSON inválido, corpo grande, mídia inválida e rate limit/retry |
| `tests/transactions.test.ts` | Rollback e descarte de conexão se o rollback falhar |
| `tests/metrics.test.ts` | NPS, médias, satisfação e turnos em São Paulo |

Um teste compara o inventário real das rotas Fastify com OpenAPI e com os caminhos exercitados. Isso detecta operações removidas ou não documentadas. Os testes de falha confirmam que erros após gravar resposta/ocorrência não deixam registros parciais e que uma rotação de refresh revertida conserva a sessão anterior.

`tsconfig.test.json` inclui os testes na verificação de tipos sem emitir declarações. O build de produção compila somente `src/`, sem testes.

## Limites

PGlite valida SQL e constraints PostgreSQL, mas usa um adaptador de transporte e uma conexão. Não comprova comportamento de sockets/TLS, contenção de locks entre múltiplas conexões, limites reais do pool, concorrência de refresh/submissão, desempenho, backup ou configuração do Render/Aiven. Não foi gerado percentual de cobertura. Antes do deploy, execute esses cenários em staging com PostgreSQL nativo e dados sanitizados.

O frontend não foi alterado nem testado visualmente, conforme o escopo escolhido. A leitura de seus contratos orientou a preservação do JSON; validação ponta a ponta e do layout deve ocorrer no repositório correspondente. O worker de e-mail não existe neste backend e não pode ser validado como entrega de mensagem.

Resultados finais e inventário de arquivos: [REFACTOR-REPORT.md](REFACTOR-REPORT.md). O relatório de 25/11 em `plano-e-relatorio-de-testes.md` é histórico.
