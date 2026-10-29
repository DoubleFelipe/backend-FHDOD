# Segurança

- JWTs de acesso HS256 contêm apenas identidade, papel e estado de troca de senha e duram 15 minutos por padrão. Refresh tokens duram 30 dias, armazenam apenas hash SHA-256 e JTI, rotacionam no uso e podem ser revogados no logout. Use segredos aleatórios distintos com pelo menos 32 caracteres, guardados num gerenciador de segredos.
- Senhas usam Argon2id. A troca exige senha atual e nova senha de pelo menos 12 caracteres. `must_change_password` bloqueia rotas do painel até a troca.
- Administradores têm acesso global; gestores são conferidos em `sector_managers` em cada operação por setor. Um `sector_id` enviado pelo cliente nunca concede acesso.
- Configure origens CORS explicitamente. CORS não usa credenciais porque tokens bearer retornam em JSON. Se adotar cookies, implemente `Secure`, `HttpOnly`, `SameSite`, validação de origem e proteção CSRF.
- Helmet, limites globais/login/submissão pública, corpo de 32 KiB, validação estrita, limites de texto/lista/paginação, erros centralizados e SQL parametrizado estão habilitados.
- Logs ocultam cabeçalhos de autorização/cookies; não registre tokens, segredos, comentários ou contatos. Erros não retornam stack trace. Readiness não revela detalhes da conexão.
- Em produção, PostgreSQL exige validação TLS. Configure `DATABASE_CA_CERT_PATH` com a CA da Aiven e use URL com hostname compatível. Em desenvolvimento local, `sslmode=disable` pode ser usado; nunca em produção.
- Separe usuários de runtime e migration, restrinja rede e permissões na Aiven, rotacione segredos e revogue sessões em incidentes.

Pendências operacionais: provisionamento de contas, worker/fila de e-mail e políticas de retenção e exclusão.
