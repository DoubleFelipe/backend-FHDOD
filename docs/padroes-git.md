# Guia de contribuição e versionamento

## 1. Objetivo e escopo

Este guia estabelece um fluxo simples para a dupla manter alterações rastreáveis e revisáveis. É uma proposta de trabalho para contribuições futuras;

## 2. Estratégia de branches proposta

- `main`: versão estável e pronta para entrega/publicação.
- `develop`: integração das funcionalidades e documentação antes da versão estável.
- `feature/nome-da-funcionalidade`: nova capacidade.
- `fix/nome-do-problema`: correção.
- `docs/nome-da-documentacao`: documentação.

Use nomes curtos, minúsculos, sem acentos e separados por hífen, por exemplo `feature/public-survey`, `fix/openapi-attended-at` e `docs/project-requirements`. 

## 3. Commits: Conventional Commits

Forma recomendada: `tipo(escopo): descrição no imperativo`, com título objetivo e corpo opcional para motivação/impacto. Tipos adequados:

| Tipo | Uso |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de comportamento |
| `docs` | Documentação |
| `style` | Formatação sem mudança funcional |
| `refactor` | Reestruturação sem mudança funcional pretendida |
| `test` | Testes |
| `chore` | Dependências e manutenção/configuração |

Exemplos:

```text
feat(survey): adiciona submissão idempotente
fix(openapi): alinha campos opcionais da pesquisa
docs(api): documenta filtros de respostas
test(auth): cobre rejeição de credencial inválida
chore(config): ignora arquivos de ambiente locais
```

## 4. Fluxo proposto

1. Atualizar `develop` e criar branch de trabalho a partir dela.
2. Implementar uma tarefa delimitada; não misturar mudanças sem relação.
3. Rodar verificações pertinentes disponíveis localmente (`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`) e relatar resultado real.
4. Criar commits pequenos e padronizados, sem credenciais, arquivos `.env` ou dados pessoais.
5. Abrir PR para `develop` com objetivo, critérios de aceitação, impacto em API/schema/configuração, migrations e evidências de verificação.
6. Solicitar revisão pela outra pessoa da dupla; priorizar autenticação, autorização, dados pessoais e migrations.
7. Responder comentários e atualizar a branch; registrar testes repetidos após correções.
8. Integrar após revisão e verificações acordadas; promover uma entrega estável de `develop` para `main`.

## 5. Pull Request e revisão

Modelo sugerido:

```markdown
## Objetivo
[o que e por que]

## Alterações
- [itens]

## Verificação
- [comando] — [resultado observado]

## Impactos
- API / banco / variáveis / migrations / rollback: [detalhes]
```

Revisar correção e validação de entradas, autorização e privacidade, retrocompatibilidade HTTP, integridade/transação, migrations e configuração segura. Não inventar aprovação: registrar pessoas e decisão somente na plataforma real utilizada pela equipe.

## 6. Conflitos e boas práticas

- Sincronize com a branch alvo antes de integrar; mantenha commit/PR focado.
- Resolva conflitos entendendo a intenção das duas versões, não escolhendo automaticamente um lado.
- Revise `git diff` após resolução e rode novamente as verificações pertinentes.
- Não force push em branch compartilhada sem coordenação da dupla.
- Não faça commit de `.env`, chaves, certificados privados, tokens ou dumps.
- Preserve migrations já aplicadas; mudanças de schema devem ser incrementais e compatíveis com deploy.
- Não reescreva autoria ou atribua contribuição individual sem evidência.

