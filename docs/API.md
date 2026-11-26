# API HTTP

Prefixo: `/api/v1`. As 25 operações existentes foram preservadas na refatoração MVC de 26/11/2026. Interface OpenAPI/Swagger: `/api/docs`; especificação JSON: `/api/docs/json`. Os schemas de entrada Zod também geram a documentação de corpos, parâmetros e filtros. Sucessos mantêm seus objetos/listas, sem envelope adicional. Erros seguem `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`. Validação retorna 400, autenticação inválida 401, falta de permissão 403, recurso ausente 404, conflito de unicidade 409 e falha inesperada 500. Corpo acima de 32 KiB retorna 413; mídia inválida 415; rate limit 429 com cabeçalhos de espera. Respostas não incluem stack trace ou detalhes SQL.

## Autenticação

| Método e caminho | Acesso | Comportamento |
|---|---|---|
| `POST /auth/login` | Público, limite padrão 5/minuto/IP | Recebe `{email,password}` e retorna tokens bearer e `mustChangePassword`. |
| `POST /auth/refresh` | Público, limite padrão 5/minuto/IP | Recebe `{refreshToken}` e rotaciona o token. |
| `POST /auth/logout` | Público | Recebe `{refreshToken}` e revoga a sessão; retorna 204. |
| `PATCH /auth/password` | Bearer | Recebe `{currentPassword,newPassword}`; senha nova de 12 a 200 caracteres. |
| `GET /auth/me` | Bearer | Retorna perfil ativo e sinalizador `mustChangePassword`. |

Use `Authorization: Bearer <accessToken>` nas rotas do painel. Contas que precisam trocar a senha podem consultar `/auth/me` e trocar a senha, mas não acessar o painel até concluí-la. O backend confere o perfil ativo, papel e estado de troca atuais no banco a cada requisição protegida. Logout revoga o refresh; o access já emitido continua sujeito ao TTL e à validação do perfil ativo.

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

`GET /surveys/public/{slug}` retorna pesquisa publicada de setor ativo e perguntas aplicáveis ativas, incluindo `sectorId` nulo para perguntas gerais. `POST /surveys/public/{slug}/responses` recebe `{attendedAt?, npsScore: 0..10, answers: [{questionId,score:1..5,questionText}], complaint?: {comment?,contact?,consent}}`. `attendedAt` é opcional; sem ele, filtros e relatórios usam `created_at` (hora de submissão). O texto da pergunta é salvo como exibido no momento do envio. Envie `Idempotency-Key` como UUID; a chave é única dentro da pesquisa. A primeira submissão retorna 201; repetição retorna 200 com o ID original. Contato exige consentimento. Uma ocorrência só pode acompanhar ao menos uma nota abaixo de 3. A submissão e a eventual tarefa de notificação são gravadas atomicamente. Limite padrão: 10 submissões por minuto/IP e corpo de até 32 KiB. A especificação OpenAPI apresenta `attendedAt` como opcional, de acordo com o validador da rota.

## Painel e relatórios

| Método e caminho | Acesso e filtros |
|---|---|
| `GET /dashboard/metrics` | Bearer; filtros `sectorId`, `from`, `to` (ISO) e `shift=morning\|afternoon\|night`. Retorna contagens NPS, distribuição de respostas 1–5 e agregados por setor autorizados. |
| `GET /sectors` | Bearer; admins veem todos; gestores, apenas os setores associados. |
| `POST /sectors` | Admin ou Ouvidoria; recebe `name` e `slug`. |
| `POST /surveys` | Admin/Ouvidoria ou gestor atribuído ao setor; recebe `sector_id`, `title` (2–150 caracteres), `tablet_reset_seconds` (10–120) e publica pesquisa. Uma pesquisa publicada por setor. |
| `GET /questions` | Bearer; Admin/Ouvidoria veem todas; gestor vê perguntas gerais e de seus setores. |
| `POST /questions` | Admin/Ouvidoria ou gestor do setor; recebe `text` (3–300), `position` (0–1000), `sector_id` (UUID ou nulo para pergunta geral); cria rating opcional. Gestor não cria pergunta geral. |
| `PATCH /questions/{id}` | Admin/Ouvidoria ou gestor do setor; recebe `{active:false}` e desativa a pergunta rating sem excluir seu histórico. |
| `GET /settings/notifications` | Admin ou Ouvidoria. |
| `PUT /settings/notifications` | Admin ou Ouvidoria; atualiza destinatários e ativação. |
| `GET /complaints` | Admin e Ouvidoria; filtros `sectorId`, `status`, `limit` (1–100, padrão 25) e `offset` (0–100000). |
| `PATCH /complaints/{id}` | Admin e Ouvidoria; recebe `{status: open\|in_progress\|closed}`. |
| `GET /reports/responses` | Admin e Ouvidoria; filtros `sectorId`, `from`, `to`, `shift`, `limit` e `offset`; paginação da mais recente para a mais antiga. Gestores não acessam respostas individuais. |
| `GET /tv/metrics` | Público; somente indicadores agregados, sem linhas individuais, comentários ou contatos. |
| `GET /health/live` | Público; verifica se o processo está ativo. |
| `GET /health/ready` | Público; retorna 503 se o banco estiver indisponível, sem expor detalhes. |

`attendedAt` é opcional; quando ausente, filtros e relatórios usam `created_at` (hora de submissão). O turno é calculado em `America/Sao_Paulo`, usando `attendedAt` quando enviado e, sem ele, a hora da submissão. Nos endpoints que aceitam intervalo, `from` é inclusivo e `to` exclusivo; quando ambos são informados, exige-se `from < to`. `GET /reports/responses` inclui respostas paginadas, notas e campos de Ouvidoria apenas para Admin/Ouvidoria. Exportação de arquivo não está implementada no backend; o frontend agrega páginas para gerar Excel.
