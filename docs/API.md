# API HTTP

Prefixo: `/api/v1`. Interface OpenAPI/Swagger: `/api/docs`; especificação JSON: `/api/docs/json`. Erros seguem `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`. Validação retorna 400, autenticação inválida 401, falta de permissão 403, recurso ausente 404 e falha inesperada 500. Em produção, respostas não incluem stack trace.

## Autenticação

| Método e caminho | Acesso | Comportamento |
|---|---|---|
| `POST /auth/login` | Público, limite padrão 5/minuto/IP | Recebe `{email,password}` e retorna tokens bearer e `mustChangePassword`. |
| `POST /auth/refresh` | Público, limite padrão 5/minuto/IP | Recebe `{refreshToken}` e rotaciona o token. |
| `POST /auth/logout` | Público | Recebe `{refreshToken}` e revoga a sessão; retorna 204. |
| `PATCH /auth/password` | Bearer | Recebe `{currentPassword,newPassword}`; senha nova de 12 a 200 caracteres. |

Use `Authorization: Bearer <accessToken>` nas rotas do painel. Contas que precisam trocar a senha só podem acessar a rota de troca até concluí-la.

## Pesquisas públicas

`GET /surveys/public/{slug}` retorna pesquisa publicada de setor ativo e perguntas aplicáveis ativas. `POST /surveys/public/{slug}/responses` recebe `{npsScore: 0..10, answers: [{questionId,score:1..5,questionText}], complaint?: {comment?,contact?,consent}}`. O texto da pergunta é salvo como exibido no momento do envio. Envie `Idempotency-Key` como UUID; a chave é única dentro da pesquisa. A primeira submissão retorna 201; repetição retorna 200 com o ID original. Contato exige consentimento. A submissão e a eventual tarefa de notificação são gravadas atomicamente. Limite padrão: 10 submissões por minuto/IP e corpo de até 32 KiB.

## Painel e relatórios

| Método e caminho | Acesso e filtros |
|---|---|
| `GET /dashboard/metrics` | Bearer; filtros `sectorId`, `from`, `to` (ISO) e `shift=morning\|afternoon\|night`. Retorna total, NPS, média NPS e percentual de notas de avaliação >= 4. |
| `GET /sectors` | Bearer; admins veem todos; gestores, apenas os setores associados. |
| `GET /complaints` | Bearer; filtros `sectorId`, `status`, `limit` (1–100, padrão 25) e `offset` (0–100000). |
| `PATCH /complaints/{id}` | Bearer; recebe `{status: open\|in_progress\|closed}`; valida escopo do setor. |
| `GET /reports/responses` | Bearer; filtros `sectorId`, `from`, `to`, `shift`, `limit` e `offset`; paginação da mais recente para a mais antiga. |
| `GET /health/live` | Público; verifica se o processo está ativo. |
| `GET /health/ready` | Público; retorna 503 se o banco estiver indisponível, sem expor detalhes. |

O servidor calcula o plantão usando `America/Sao_Paulo`: manhã 07:00–12:00, tarde 12:00–19:00 e noite 19:00–07:00. Esses limites são provisórios e precisam ser confirmados com o frontend. `from` é inclusivo e `to` exclusivo. Exportação de arquivo não está implementada; use paginação limitada.
