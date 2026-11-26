# Plano de refatoração MVC — 26/11/2026

## Análise anterior às alterações

O checkout contém somente o backend. Node.js/TypeScript, Fastify, PostgreSQL (`pg`),
Zod, JWT (`jose`) e Argon2id serão preservados. Não há frontend, SDK de banco no
cliente ou worker de e-mail para alterar/testar. O Render usa `npm run build`,
`npm run db:migrate`, `npm start` e readiness; esses contratos serão mantidos.

`src/app.ts` mistura plugins, rotas, validação, SQL, autenticação e regras.
Há serviços parciais de pesquisa/acesso, funções puras de métricas, duas migrations,
bootstrap de administrador e seis testes. Os contratos existentes incluem respostas
JSON sem envelope de sucesso, bearer, perfis admin/ouvidoria/gestor, escopo por setor,
senha temporária obrigatória, submissão idempotente e gravação atômica de ocorrência/job.
Data de atendimento opcional, textos históricos e campos snake_case/camelCase serão
preservados. Gestores podem gerenciar pesquisas/perguntas dos próprios setores,
apesar de descrições anteriores indicarem apenas Admin/Ouvidoria.

## Etapas e critérios

1. Instalar dependências pelo lockfile e executar verificações de referência.
2. Extrair configuração, schemas, middleware e documentação OpenAPI.
3. Separar rotas → controllers → services → models, por recurso. SQL fica em models;
   transações reutilizam o mesmo cliente e um helper de rollback/liberação.
4. Preservar URLs `/api/v1`, payloads, status e comandos de deploy; não mover a raiz
   para `backend/`, pois este repositório já é o backend e o Render depende dela.
5. Corrigir falhas de segurança verificadas: perfil ativo/papel atual no backend,
   troca obrigatória de senha sem depender de claims antigos, respostas de erro HTTP
   consistentes e logs sem valores SQL sensíveis.
6. Cobrir todas as operações HTTP, papéis, validação, erros, refresh e submissões;
   usar PostgreSQL isolado se disponível, nunca credenciais de produção.
7. Atualizar arquitetura, contratos, execução, integração externa e relatório real.

## Preservação e rollback

Não executar migrations contra bancos existentes, importar dados, alterar migrations
aplicadas, excluir funcionalidades nem publicar. A mudança estrutural não exige DDL.
Rollback consiste em restaurar a versão anterior do código; o esquema não muda.
O frontend externo deverá ser validado no repositório correspondente antes do deploy.
