# API HTTP

Prefixo: `/api/v1`. A API oferece 27 operações, incluindo listagem e arquivamento de pesquisas. Interface OpenAPI/Swagger: `/api/docs`; especificação JSON: `/api/docs/json`. Os schemas de entrada Zod também geram a documentação de corpos, parâmetros e filtros. Sucessos mantêm seus objetos/listas, sem envelope adicional. Erros seguem `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`. Validação retorna 400, autenticação inválida 401, falta de permissão 403, recurso ausente 404, conflito de unicidade 409 e falha inesperada 500. Corpo acima de 32 KiB retorna 413; mídia inválida 415; rate limit 429 com cabeçalhos de espera. Respostas não incluem stack trace ou detalhes SQL.

Base URL de produção informada: [`https://backend-fhdod.onrender.com/api/v1`](https://backend-fhdod.onrender.com/api/v1). A documentação interativa publicada está prevista em [`https://backend-fhdod.onrender.com/api/docs`](https://backend-fhdod.onrender.com/api/docs); a disponibilidade desses endereços não foi confirmada por uma checagem externa neste ambiente. O frontend informado está em [`https://fhdod.vercel.app/`](https://fhdod.vercel.app/).

## Autenticação

| Método e caminho       | Acesso                             | Comportamento                                                              |
| ---------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `POST /auth/login`     | Público, limite padrão 5/minuto/IP | Recebe `{email,password}` e retorna tokens bearer e `mustChangePassword`.  |
| `POST /auth/refresh`   | Público, limite padrão 5/minuto/IP | Recebe `{refreshToken}` e rotaciona o token.                               |
| `POST /auth/logout`    | Público                            | Recebe `{refreshToken}` e revoga a sessão; retorna 204.                    |
| `PATCH /auth/password` | Bearer                             | Recebe `{currentPassword,newPassword}`; senha nova de 12 a 200 caracteres. |
| `GET /auth/me`         | Bearer                             | Retorna perfil ativo e sinalizador `mustChangePassword`.                   |

Use `Authorization: Bearer <accessToken>` nas rotas do painel. Contas que precisam trocar a senha podem consultar `/auth/me` e trocar a senha, mas não acessar o painel até concluí-la. O backend confere o perfil ativo, papel e estado de troca atuais no banco a cada requisição protegida. Logout revoga o refresh; o access já emitido continua sujeito ao TTL e à validação do perfil ativo.

## Administração de usuários

| Método e caminho | Acesso | Comportamento                                                |
| ---------------- | ------ | ------------------------------------------------------------ |
| `GET /users`     | Admin  | Lista contas sem hashes ou credenciais.                      |
| `POST /users`    | Admin  | Cria conta ativa que deve trocar a senha no primeiro acesso. |

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

| Método e caminho              | Acesso e filtros                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /dashboard/metrics`      | Bearer; filtros `sectorId`, `from`, `to` (ISO) e `shift=morning\|afternoon\|night`. Retorna contagens NPS, distribuição de respostas 1–5 e agregados por setor autorizados.           |
| `GET /sectors`                | Bearer; Admin/Ouvidoria veem todos; gestores, apenas os setores associados.                                                                                                           |
| `GET /surveys`                | Admin/Ouvidoria; lista pesquisas não arquivadas com identificação do setor.                                                                                                           |
| `DELETE /surveys/{id}`        | Admin/Ouvidoria; arquiva a pesquisa sem apagar histórico; retorna 204.                                                                                                                |
| `POST /sectors`               | Admin ou Ouvidoria; recebe `name` e `slug`.                                                                                                                                           |
| `POST /surveys`               | Admin/Ouvidoria ou gestor atribuído ao setor; recebe `sector_id`, `title` (2–150 caracteres), `tablet_reset_seconds` (10–120) e publica pesquisa. Uma pesquisa publicada por setor.   |
| `GET /questions`              | Bearer; Admin/Ouvidoria veem todas; gestor vê perguntas gerais e de seus setores.                                                                                                     |
| `POST /questions`             | Admin/Ouvidoria ou gestor do setor; recebe `text` (3–300), `position` (0–1000), `sector_id` (UUID ou nulo para pergunta geral); cria rating opcional. Gestor não cria pergunta geral. |
| `PATCH /questions/{id}`       | Admin/Ouvidoria ou gestor do setor; recebe `{active:false}` e desativa a pergunta rating sem excluir seu histórico.                                                                   |
| `GET /settings/notifications` | Admin ou Ouvidoria.                                                                                                                                                                   |
| `PUT /settings/notifications` | Admin ou Ouvidoria; atualiza destinatários e ativação.                                                                                                                                |
| `GET /complaints`             | Admin e Ouvidoria; filtros `sectorId`, `status`, `limit` (1–100, padrão 25) e `offset` (0–100000).                                                                                    |
| `PATCH /complaints/{id}`      | Admin e Ouvidoria; recebe `{status: open\|in_progress\|closed}`.                                                                                                                      |
| `GET /reports/responses`      | Admin e Ouvidoria; filtros `sectorId`, `from`, `to`, `shift`, `limit` e `offset`; paginação da mais recente para a mais antiga. Gestores não acessam respostas individuais.           |
| `GET /tv/metrics`             | Público; somente indicadores agregados, sem linhas individuais, comentários ou contatos.                                                                                              |
| `GET /health/live`            | Público; verifica se o processo está ativo.                                                                                                                                           |
| `GET /health/ready`           | Público; retorna 503 se o banco estiver indisponível, sem expor detalhes.                                                                                                             |

### Corpos das operações de administração

Os nomes de propriedades são os aceitos pelos handlers; há uso de `camelCase` e `snake_case` conforme a rota.

| Operação                      | Corpo / validação                                                                | Resposta de sucesso                                        |
| ----------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `POST /sectors`               | `{name,slug}`; nome 2–100; slug até 100, minúsculas/números separados por hífen  | 201 com `{id,name,slug,active}`                            |
| `POST /surveys`               | `{sector_id,title,tablet_reset_seconds}`; UUID, título 2–150, inteiro 10–120     | 201 com `{id,sector_id,title,status,tablet_reset_seconds}` |
| `POST /questions`             | `{text,position,sector_id}`; texto 3–300, posição inteira 0–1000, UUID ou `null` | 201 com `{id,text,kind,sector_id,position,active}`         |
| `PATCH /questions/{id}`       | `{active:false}`                                                                 | 200 com `{id,active}`                                      |
| `PUT /settings/notifications` | `{notification_emails,notifications_enabled}`; até 20 e-mails, booleano          | 200 com a configuração                                     |
| `PATCH /complaints/{id}`      | `{status:"open"}`; também `in_progress` ou `closed`                              | 200 com `{id,status,updated_at}`                           |

`GET /surveys` é exclusivo de Admin e Ouvidoria e lista pesquisas não arquivadas como `{id,title,status,sector_id,sector_name,sector_slug}`. `DELETE /surveys/{id}` exige os mesmos perfis e retira a publicação por exclusão lógica (`status=archived`), retornando 204. O ID precisa ser UUID; ID inválido retorna 400 e pesquisa inexistente, 404. Repetir a exclusão de uma pesquisa já arquivada retorna 204. Respostas, notas, registros de Ouvidoria e indicadores históricos são preservados. Os endpoints públicos deixam de oferecer a pesquisa arquivada e recusam novas respostas. Uma resposta em andamento que já bloqueou a pesquisa termina antes do arquivamento.

Após a exclusão, é possível publicar uma nova pesquisa para o mesmo setor. Uma segunda publicação sem antes retirar a anterior continua retornando 409 pelo índice único. A estrutura existente já oferece o estado `archived`, portanto não é necessária migration. Não há rota para editar ou restaurar pesquisas. A API salva o intervalo do tablet; a execução visual desse reinício depende do cliente externo.

### Filtros e resultados

Nos endpoints que aceitam intervalo, `from` é inclusivo e `to` exclusivo; quando ambos são informados, exige-se `from < to`. Datas usam o validador `datetime()` e `COALESCE(attended_at,created_at)`. O turno é calculado em `America/Sao_Paulo`, usando `attendedAt` quando enviado e, sem ele, a hora da submissão: `morning` [07:00,12:00), `afternoon` [12:00,19:00), `night` [19:00,07:00).

`GET /dashboard/metrics` retorna `total`, `count` (alias), `nps`, `average`, `averageNpsScore`, `satisfaction`, `satisfactionPercent` (alias), contagens `promoters`, `passives`, `detractors`, `ratings`, distribuição 1–5 e `sectors` com `{id,name,total,nps,average}`. NPS = percentual de promotores (9–10) menos detratores (0–6), arredondado ao inteiro. `average` é a média das avaliações 1–5; satisfação é o percentual dessas avaliações com nota ≥4. Cálculos sem valores retornam `null`; contagens retornam zero. O painel considera somente avaliações de perguntas `rating`.

`GET /tv/metrics` retorna agregados globais sem filtros por setor/período/turno, com `sectors:[]`; lê todas as notas em `answers`. Não entrega comentários, contatos nem respostas individuais.

`GET /complaints` e `GET /reports/responses` retornam `{items,limit,offset}`, sem total de registros, com limite padrão 25 (1–100) e offset padrão 0 (0–100000). O relatório inclui `{id,sector_id,sector_name,nps,shift,attended_at,created_at,answers,complaint}` por item; notas usam `{questionId,questionText,score}` e ocorrência usa `{comment,contact,contactConsent,status}` ou `null`. Exportação de arquivos não está implementada; a geração de Excel por um frontend não pode ser confirmada neste checkout.

Saúde: liveness retorna `200 {status:"ok"}` sem consulta ao banco; readiness consulta `SELECT 1` e retorna `200 {status:"ready"}` ou `503 {status:"unavailable"}`.

## Limites da especificação online

O OpenAPI reutiliza os schemas Zod para documentar corpos, parâmetros e filtros aceitos pelas rotas. Os formatos de resposta e as permissões são descritos por operação; esta referência detalha também os indicadores e as regras de negócio.
