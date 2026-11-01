# API HTTP

Prefixo: `/api/v1`. Interface OpenAPI/Swagger: `/api/docs`; especificação JSON: `/api/docs/json`. Erros seguem `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`. Validação retorna 400, autenticação inválida 401, falta de permissão 403, recurso ausente 404 e falha inesperada 500. Em produção, respostas não incluem stack trace.

## Autenticação

| Método e caminho | Acesso | Comportamento |
|---|---|---|
| `POST /auth/login` | Público, limite padrão 5/minuto/IP | Recebe `{email,password}` e retorna tokens bearer e `mustChangePassword`. |
| `POST /auth/refresh` | Público, limite padrão 5/minuto/IP | Recebe `{refreshToken}` e rotaciona o token. |
| `POST /auth/logout` | Público | Recebe `{refreshToken}` e revoga a sessão; retorna 204. |
| `PATCH /auth/password` | Bearer | Recebe `{currentPassword,newPassword}`; senha nova de 12 a 200 caracteres. |
| `GET /auth/me` | Bearer | Retorna perfil ativo e sinalizador `mustChangePassword`. |

Use `Authorization: Bearer <accessToken>` nas rotas do painel. Contas que precisam trocar a senha só podem acessar a rota de troca até concluí-la.

## Administração de usuários

| Método e caminho | Acesso | Comportamento |
|---|---|---|
| `GET /users` | Admin | Lista contas sem hashes ou credenciais. |
| `POST /users` | Admin | Cria conta ativa que deve trocar a senha no primeiro acesso. |

Exemplo de criação:

```json
{
  "email": "gestor@hospital.org.br",
  "fullName": "Nome do Gestor",
  "role": "sector_manager",
  "temporaryPassword": "senha-temporaria-forte",
  "sectorIds": ["00000000-0000-4000-8000-000000000001"]
}
```

`temporaryPassword` precisa ter entre 12 e 200 caracteres. Gestores precisam de ao menos um setor ativo; Admin e Ouvidoria não recebem atribuições de setor. O backend armazena somente hash Argon2id. A senha temporária deve ser entregue ao usuário por um canal aprovado fora da API e não deve ser registrada em logs. Apenas Admin pode provisionar contas; não há envio de convite por e-mail nesta versão.

## Pesquisas públicas

`GET /surveys/public/{slug}` retorna pesquisa publicada de setor ativo e perguntas aplicáveis ativas, incluindo `sectorId` nulo para perguntas gerais. `POST /surveys/public/{slug}/responses` recebe `{attendedAt, npsScore: 0..10, answers: [{questionId,score:1..5,questionText}], complaint?: {comment?,contact?,consent}}`. `attendedAt` é a data/hora do atendimento informada pelo paciente; não é a data de submissão. O texto da pergunta é salvo como exibido no momento do envio. Envie `Idempotency-Key` como UUID; a chave é única dentro da pesquisa. A primeira submissão retorna 201; repetição retorna 200 com o ID original. Contato exige consentimento. Uma ocorrência só pode acompanhar ao menos uma nota abaixo de 3. A submissão e a eventual tarefa de notificação são gravadas atomicamente. Limite padrão: 10 submissões por minuto/IP e corpo de até 32 KiB.

## Painel e relatórios

| Método e caminho | Acesso e filtros |
|---|---|
| `GET /dashboard/metrics` | Bearer; filtros `sectorId`, `from`, `to` (ISO) e `shift=morning\|afternoon\|night`. Retorna contagens NPS, distribuição de respostas 1–5 e agregados por setor autorizados. |
| `GET /sectors` | Bearer; admins veem todos; gestores, apenas os setores associados. |
| `POST /sectors` | Admin ou Ouvidoria; recebe `name` e `slug`. |
| `POST /surveys` | Admin ou Ouvidoria; publica pesquisa para setor. |
| `GET /questions` | Admin ou Ouvidoria; lista perguntas ativas. |
| `POST /questions` | Admin ou Ouvidoria; cria pergunta de avaliação opcional 1–5. |
| `PATCH /questions/{id}` | Admin ou Ouvidoria; desativa pergunta de avaliação. |
| `GET /settings/notifications` | Admin ou Ouvidoria. |
| `PUT /settings/notifications` | Admin ou Ouvidoria; atualiza destinatários e ativação. |
| `GET /complaints` | Admin e Ouvidoria; filtros `sectorId`, `status`, `limit` (1–100, padrão 25) e `offset` (0–100000). |
| `PATCH /complaints/{id}` | Admin e Ouvidoria; recebe `{status: open\|in_progress\|closed}`. |
| `GET /reports/responses` | Admin e Ouvidoria; filtros `sectorId`, `from`, `to`, `shift`, `limit` e `offset`; paginação da mais recente para a mais antiga. Gestores não acessam respostas individuais. |
| `GET /tv/metrics` | Público; somente indicadores agregados, sem linhas individuais, comentários ou contatos. |
| `GET /health/live` | Público; verifica se o processo está ativo. |
| `GET /health/ready` | Público; retorna 503 se o banco estiver indisponível, sem expor detalhes. |

`attendedAt` na submissão pública é a data e hora informadas pelo paciente para o atendimento, distinta de `created_at` (envio da avaliação). O backend ainda armazena `shift` como nulo; turnos foram adiados. Nos endpoints que aceitam intervalo, `from` é inclusivo e `to` exclusivo. `GET /reports/responses` inclui respostas paginadas, notas e campos de Ouvidoria apenas para Admin/Ouvidoria. Exportação de arquivo não está implementada no backend; o frontend agrega páginas para gerar Excel.
