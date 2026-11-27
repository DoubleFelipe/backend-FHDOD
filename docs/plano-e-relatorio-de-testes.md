> Registro histórico de 25/11/2026, anterior à refatoração MVC. Para a suíte e os resultados atuais, consulte [TESTING.md](TESTING.md) e [REFACTOR-REPORT.md](REFACTOR-REPORT.md).

# Plano e relatório de testes

**Projeto:** API FHDOD — Pesquisa de Satisfação · **Data de execução:** 25/11/2026.

# PARTE I — PLANO DE TESTES

## 1. Objetivo

Verificar cálculos de domínio, respostas HTTP básicas, publicação da especificação e qualidade estática/build do backend sem atingir dados reais.

## 2. Escopo

Há testes automatizados Vitest em `src/domain/metrics.test.ts` e `src/app.test.ts`. São cobertos NPS/média/satisfação/turno, liveness, rejeição de submissão sem chave de idempotência e geração Swagger/OpenAPI. Não há testes automatizados de integração com PostgreSQL, auth/roles usando fixtures de banco, interface visual ou fluxo end-to-end com frontend no checkout.

## 3. Estratégia e técnicas

- Testes unitários determinísticos das funções de métricas.
- Testes HTTP via `Fastify.inject`, sem bind de porta e sem consulta ao banco nos fluxos selecionados.
- Testes de contrato em respostas OpenAPI.
- Análise estática TypeScript/ESLint e compilação.
- Casos negativos de entrada inválida e fronteiras de escala/turno.

## 4. Ferramentas e ambiente

- Vitest 5, TypeScript, Fastify injection; Node.js/npm presentes no ambiente da execução.
- Scripts: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- URL de banco de teste sintética definida no setup de `src/app.test.ts`; testes executados não consultam esse banco. Banco real de teste não configurado/necessário para os casos existentes.
- Cobertura: não há script, configuração ou relatório de cobertura identificado. Não reportar percentual.

## 5. Níveis

| Nível | Situação do projeto |
|---|---|
| Unitário | Presente para métricas |
| Integração com banco | Não implementado; não executado |
| Funcional HTTP | Parcial, por `Fastify.inject` para três fluxos |
| Interface / E2E frontend | Não identificado; frontend ausente do checkout |
| Estático/compilação | Scripts disponíveis e executados nesta verificação |

## 6. Casos de teste

| ID | Funcionalidade / objetivo | Pré-condições | Passos e dados de entrada | Resultado esperado | Resultado obtido / status |
|---|---|---|---|---|---|
| CT001 | Métricas: calcular NPS, média, satisfação e turno; verificar listas vazias e faixas São Paulo | Node/npm; Vitest | Executar `npm test`; casos em `src/domain/metrics.test.ts`, incluindo NPS `[10,9,7,6]` e datas ISO de manhã/tarde/noite | Valores e classificações esperados pelo domínio; vazio retorna `null` quando previsto | Aprovado na execução final: 3 testes de domínio passaram |
| CT002 | Health liveness | App criado por `buildApp`; sem banco | `GET /api/v1/health/live` via injeção | HTTP 200 e `{status:"ok"}` sem consulta ao banco | Aprovado na execução final |
| CT003 | Validação de chave de idempotência | App pronto; sem banco para rejeição antecipada | POST em `/api/v1/surveys/public/sample/responses` sem `Idempotency-Key` | HTTP 400 e código `VALIDATION_ERROR` | Aprovado na execução final |
| CT004 | UI e contrato Swagger/OpenAPI | App pronto | GET `/api/docs` e `/api/docs/json`; validar versão, paths, corpo de criação e esquema de submissão | UI 200; OpenAPI 3.1; rotas e campos refletem contrato real (attendedAt opcional) | Aprovado após correção do teste de contrato, que antes esperava campo obrigatório incorretamente |
| CT005 | Persistência, autorização por setor e migrations em PostgreSQL | Requer banco isolado e credenciais de teste próprias | Preparar dados e testar login/roles/transações/migrations | Regras e integridade verificadas em banco descartável | Não executado: suíte de integração e banco dedicado não estão configurados |

# PARTE II — RELATÓRIO DE EXECUÇÃO

## 7. Ambiente e comandos executados

Data: 25/11/2026. Ambiente de desenvolvimento do repositório, dependências instaladas no workspace; `NODE_ENV=test` e URL PostgreSQL fictícia são definidos pelo setup HTTP. Nenhum comando conectou a banco real nem executou migrations.

```text
npm test -- --hookTimeout=30000  — 6 testes aprovados (2 arquivos)
npm run lint                    — concluído com código 0
npm run typecheck               — concluído com código 0
npm run build                   — concluído com código 0
```

A primeira chamada padrão `npm test` atingiu timeout de 10 segundos no `beforeAll`, deixando os três testes HTTP ignorados; os três testes de métricas passaram. Na repetição com limite de hook maior, todos os cenários HTTP rodaram e o contrato OpenAPI falhou porque um teste exigia `attendedAt`, enquanto o schema Zod da rota o declara opcional. O OpenAPI foi alinhado ao validador e o teste ajustado para verificar opcionalidade; a execução final acima passou. O limite máximo de respostas (`PUBLIC_SUBMISSION_MAX_FIELDS`, padrão 30) também foi alinhado ao OpenAPI.

## 8. Resultado dos casos

| ID | Funcionalidade | Status | Observações |
|---|---|---|---|
| CT001 | Cálculos de métricas | Aprovado | 3 testes de domínio passaram |
| CT002 | Health liveness | Aprovado | Teste HTTP injetado; sem banco |
| CT003 | Chave idempotente ausente | Aprovado | Rejeição HTTP 400 validada |
| CT004 | Swagger/OpenAPI | Aprovado | UI/JSON e campos do contrato validados após corrigir expectativa incompatível |
| CT005 | Banco, roles e migrations | Bloqueado / não executado | Não há suíte e banco isolado configurados; nenhum resultado de banco pode ser declarado |

## 9. Falhas e correções

- **Timeout de inicialização Vitest (execução padrão):** repetido com `--hookTimeout=30000`; os casos HTTP completaram.
- **Expectativa OpenAPI incompatível:** o teste afirmava que `attendedAt` era obrigatório, mas `responseSchema` o declara opcional. Corrigida a expectativa para conferir que não está em `required`; o comportamento da API não foi alterado.
- **Limite de respostas discrepante:** documentação OpenAPI indicava 100, enquanto configuração padrão da API permite 30 (máximo configurável 100). OpenAPI agora usa `config.PUBLIC_SUBMISSION_MAX_FIELDS`.
- Nenhuma correção de lógica de negócio foi feita durante a documentação.

## 10. Cobertura e limitações

Ferramenta/relatório de cobertura não configurados; percentual **não identificado**. Os testes não validam conexão real, migrations aplicadas, JWT/Argon2 em endpoints com banco, isolamento de papel/setor, condições concorrentes de idempotência, worker de notificações nem frontend. Não há falhas funcionais confirmadas além do contrato de teste já corrigido.

## 11. Considerações finais

Os seis testes automatizados existentes, lint, verificação de tipos e build passaram na execução final. Isso não equivale a validação integrada de banco nem a teste de produção. Recomenda-se planejar CT005 em banco PostgreSQL descartável com proteção explícita contra ambiente/host de produção e adicionar cobertura mensurada se for critério acadêmico.
