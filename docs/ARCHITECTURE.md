# Arquitetura

Fastify foi escolhido pelo baixo overhead, ecossistema de plugins, ciclo de vida HTTP e suporte a testes por injeção. O TypeScript usa modo estrito. As rotas em `src/app.ts` validam entradas com Zod e encaminham as chamadas; `src/services/` contém regras de negócio, transações e autorização por setor. O acesso ao PostgreSQL é feito com SQL parametrizado. `src/domain/` reúne cálculos e erros; `src/infrastructure/` mantém banco, autenticação e hashing. A configuração é validada antes da inicialização.

A submissão pública bloqueia a pesquisa publicada, reserva uma chave idempotente por pesquisa, valida as perguntas e grava resposta, notas, ouvidoria, tarefa de notificação e associação da chave numa transação. A unicidade serializa repetições concorrentes. O plantão usa `America/Sao_Paulo`: manhã [07:00, 12:00), tarde [12:00, 19:00) e noite [19:00, 07:00). Esses horários são provisórios; confirme-os com o frontend. O cliente não escolhe o plantão.

A identidade é local: `profiles.id` é um UUID da API e as senhas usam Argon2id. Não são importados IDs ou senhas do Supabase Auth. O login emite tokens HS256 de acesso curto e renovação; os refresh tokens são registrados por JTI e hash SHA-256, rotacionados e revogáveis. Os tokens retornam em JSON para integração bearer. Uma aplicação web pode mantê-los em memória ou adotar BFF/cookies com proteção CSRF.

O ID da requisição aparece nas respostas de erro. Logs ocultam cabeçalhos de autorização e cookies e não registram corpos. As tarefas de notificação são persistidas junto à submissão; ainda não há worker ou provedor de e-mail neste repositório.
