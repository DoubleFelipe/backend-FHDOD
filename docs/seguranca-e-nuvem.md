# Segurança e nuvem

## 1. Introdução

Registra as evidências disponíveis no código sobre conexão, infraestrutura e controles. Arquivos de configuração não provam que um serviço remoto esteja provisionado ou acessível.

## 2. Infraestrutura em nuvem

O banco é PostgreSQL. `DATABASE_URL` aponta para a instância configurada pelo operador. `.env.example` comenta o uso de CA Aiven; `src/config/postgres-ssl.ts` valida CA em produção; `docs/SECURITY.md` recomenda Aiven. Assim, Aiven é o provedor esperado/documentado, mas **instância, região, plano e disponibilidade não foram verificados**. `render.yaml` descreve um serviço web Node no Render com build, migration pre-deploy e health check; não comprova implantação ativa.

```mermaid
flowchart LR
  C[Cliente HTTP / frontend externo] -->|HTTPS conforme implantação do cliente| R[API Fastify Node.js no Render conforme blueprint]
  R -->|DATABASE_URL; TLS com CA validada em produção| PG[(PostgreSQL configurado pelo operador; Aiven esperado, não verificado)]
  R -->|MIGRATION_DATABASE_URL no pre-deploy| PG
  ENV[Variáveis/segredos do ambiente] --> R
```

O fluxo real implementado é aplicação → pool `pg` → PostgreSQL. O TLS PostgreSQL é obrigatório na configuração da API em `NODE_ENV=production`; HTTPS entre cliente e API depende da plataforma/implantação e não é comprovado pela configuração local apresentada.

## 3. Configuração de conexão

Variáveis de persistência do `.env.example`:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/fhdod?sslmode=disable
MIGRATION_DATABASE_URL=postgresql://migrador:senha@localhost:5432/fhdod?sslmode=disable
DATABASE_CA_CERT_PATH=
DATABASE_CA_CERT=
DATABASE_POOL_MAX=10
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_STATEMENT_TIMEOUT_MS=10000
```

Runtime usa `DATABASE_URL`; migration usa a credencial separada `MIGRATION_DATABASE_URL`. Em produção, `src/config/index.ts` exige ambas e um dos campos da CA. `postgres-ssl.ts` configura `rejectUnauthorized: true`. O helper remove opções `sslmode`/certificados da URL para evitar conflito com configuração SSL explícita. `sslmode=disable` do exemplo é apenas para PostgreSQL local.

Outras variáveis em `.env.example` controlam ambiente/porta, segredos JWT e TTL, CORS, rate limits, limites de envio, logs e criação temporária do administrador. O arquivo `.gitignore` ignora `.env` e `.env.*`, com exceção explícita de `.env.example`. Não há valor de credencial real documentado neste guia.

## 4. Estratégias de segurança verificadas

| Controle | Situação | Evidência/limite |
|---|---|---|
| Credenciais via ambiente | Implementado e verificado | `src/config/index.ts`, `.env.example`; `.env` local fora do Git |
| Proteção de `.env` no Git | Implementado e verificado | `.gitignore` ignora `.env` e `.env.*`, libera `.env.example` |
| Controle de acesso ao banco / privilégio mínimo | Não foi possível verificar | Código separa URLs runtime e migration, mas usuários/permissões reais são externos |
| TLS entre API e PostgreSQL em produção | Parcialmente implementado | API exige CA e valida certificado; configuração/servidor externo não foi testado |
| Restrição por IP/firewall | Não foi possível verificar | Painel de nuvem/rede não está acessível neste checkout |
| SQL parametrizado | Implementado e verificado | Consultas com placeholders `$n` e argumentos separados no driver `pg` |
| Proteção contra NoSQL injection | Não se aplica ao banco implementado | Persistência é PostgreSQL/SQL |
| Validação de entrada | Implementado e verificado | Zod nas rotas e na configuração, mais checks SQL |
| Hash de senha e tokens | Implementado e verificado | Argon2id; refresh token armazenado como hash/JTI conforme `auth.ts` |
| Proteção de dados sensíveis | Parcialmente implementado | Logs redigem authorization/cookie; respostas privilegiam acesso; comentário/contato ainda são dados persistidos e acessíveis a Admin/Ouvidoria |
| Tratamento de erro | Implementado e verificado | Handler centralizado não expõe stack em produção; readiness não revela detalhes |
| Segurança HTTP/abuso | Implementado e verificado | Helmet, CORS configurável, rate limit, body limit 32 KiB |
| Backup, retenção e recuperação | Não foi possível verificar | Sem configuração operacional de backup/retention no repositório |

## 5. Procedimentos de conexão

1. Instale Node.js 22+ e npm; disponibilize PostgreSQL 15+ local ou ambiente isolado. Para produção, obtenha URL, CA e credenciais do operador cloud.
2. Na raiz do repositório, execute `npm ci` e copie `.env.example` para `.env` (PowerShell: `Copy-Item .env.example .env`).
3. Configure `DATABASE_URL`, `MIGRATION_DATABASE_URL`, segredos JWT distintos com no mínimo 32 caracteres e CA em produção. Nunca use `sslmode=disable` na configuração de produção.
4. Com banco vazio local/isolado e URL de migration configurada, aplique o esquema: `npm run db:migrate`. O executor aplica `database/migrations/*.sql` alfabeticamente e registra cada migration em `schema_migrations`.
5. Inicie a API com `npm run dev` (ou `npm run build` e `npm start`).
6. Confira `GET /api/v1/health/live` e `GET /api/v1/health/ready`; readiness verifica a conexão. Não execute migrations em produção como experimento.

O primeiro administrador, quando necessário em ambiente controlado, é provisionado com `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, `ADMIN_PASSWORD` e `npm run admin:create`; consulte `README.md`.

## 6. Recomendações futuras

Validar no painel do provedor: existência/estado da instância, versão, região, backups/PITR, rede/IP allowlist e métricas. Criar usuários distintos runtime/migration com menor privilégio necessário, guardar segredos no secret manager da plataforma, testar rotação e restauração em staging e definir retenção de dados pessoais. Confirmar HTTPS público da API e monitoramento. Essas medidas são recomendações ou validações manuais, não funcionalidades comprovadas.

## 7. Considerações finais

O código implementa validação de CA para conexões PostgreSQL em produção, uso de variáveis de ambiente, parametrização SQL e controles de autenticação/entrada. O repositório oferece configuração de serviço Render e refere-se à Aiven, mas a operação real da nuvem, restrições de rede, privilégios, backups e URL publicada dependem de confirmação manual pelo responsável.
