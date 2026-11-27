import { applyRequestSchemas } from './openapi-schemas.js';
export const openApiPaths = {
  '/api/v1/health/live': {
    get: {
      summary: 'Verificar se a API está ativa',
      description:
        'Confirma que o processo HTTP está em execução. Não verifica a conexão com o banco de dados.',
      tags: ['health'],
      responses: { '200': { description: 'Processo ativo: `{ "status": "ok" }`.' } },
    },
  },
  '/api/v1/health/ready': {
    get: {
      summary: 'Verificar se a API está pronta',
      description:
        'Verifica se as dependências necessárias, incluindo o banco de dados, estão acessíveis.',
      tags: ['health'],
      responses: {
        '200': { description: 'Serviço pronto: `{ "status": "ready" }`.' },
        '503': { description: 'Dependência indisponível: `{ "status": "unavailable" }`.' },
      },
    },
  },
  '/api/v1/auth/login': {
    post: {
      summary: 'Iniciar sessão',
      description:
        'Valida e-mail e senha e emite tokens de acesso e renovação. Contas com senha temporária devem concluí-la antes de acessar o painel.',
      tags: ['auth'],
      responses: {
        '200': {
          description: 'Autenticação concluída; retorna tokens e a indicação de troca de senha.',
        },
        '401': { description: 'Credenciais inválidas.' },
      },
    },
  },
  '/api/v1/auth/refresh': {
    post: {
      summary: 'Renovar tokens',
      description:
        'Troca um refresh token válido por um novo par de tokens. O token anterior é rotacionado.',
      tags: ['auth'],
      responses: {
        '200': { description: 'Tokens renovados.' },
        '401': { description: 'Refresh token inválido, expirado ou revogado.' },
      },
    },
  },
  '/api/v1/auth/logout': {
    post: {
      summary: 'Encerrar sessão',
      description: 'Revoga o refresh token informado. Retorna 204 sem corpo.',
      tags: ['auth'],
      responses: { '204': { description: 'Sessão encerrada.' } },
    },
  },
  '/api/v1/auth/password': {
    patch: {
      summary: 'Alterar senha',
      description:
        'Exige token Bearer válido. A nova senha deve ter de 12 a 200 caracteres. Retorna 204 sem corpo.',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
      responses: { '204': { description: 'Senha alterada.' } },
    },
  },
  '/api/v1/auth/me': {
    get: {
      summary: 'Consultar perfil autenticado',
      description: 'Retorna o perfil associado ao token Bearer atual.',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Perfil ativo.' },
        '401': { description: 'Token ausente, inválido ou expirado.' },
      },
    },
  },
  '/api/v1/users': {
    get: {
      summary: 'Listar usuários',
      description:
        'Requer autenticação e permissão administrativa. O escopo de acesso é conferido pelo backend.',
      tags: ['users'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Lista de usuários.' },
        '403': { description: 'Perfil sem permissão para esta operação.' },
      },
    },
    post: {
      summary: 'Criar usuário',
      description:
        'Cria uma conta com senha temporária; o usuário deverá trocá-la. A senha precisa ter de 12 a 200 caracteres. Requer permissão administrativa.',
      tags: ['users'],
      security: [{ bearerAuth: [] }],
      responses: {
        '201': { description: 'Usuário criado e marcado para troca de senha.' },
        '403': { description: 'Perfil sem permissão para esta operação.' },
      },
    },
  },
  '/api/v1/surveys/public/{slug}': {
    get: {
      summary: 'Consultar pesquisa pública',
      description:
        'Busca uma pesquisa publicada pelo slug e retorna as perguntas ativas disponíveis para resposta.',
      tags: ['surveys'],
      responses: {
        '200': { description: 'Pesquisa publicada e perguntas ativas.' },
        '404': { description: 'Pesquisa não encontrada ou não publicada.' },
      },
    },
  },
  '/api/v1/surveys/public/{slug}/responses': {
    post: {
      summary: 'Enviar resposta da pesquisa',
      description:
        'Rota pública. Envie um UUID no cabeçalho `Idempotency-Key`; repita a mesma chave em tentativas do mesmo envio para evitar duplicidade. Retorna 201 para novo registro e 200 para repetição reconhecida.',
      tags: ['surveys'],
      parameters: [
        { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '201': { description: 'Resposta registrada.' },
        '200': { description: 'Envio repetido reconhecido; resposta existente retornada.' },
        '400': { description: 'Dados inválidos ou cabeçalho `Idempotency-Key` ausente/inválido.' },
      },
    },
  },
  '/api/v1/dashboard/metrics': {
    get: {
      summary: 'Consultar indicadores do painel',
      description:
        'Requer Bearer. Os resultados respeitam os setores autorizados para o perfil. Aceita filtros de setor, período ISO 8601 e turno.',
      tags: ['dashboard'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Indicadores agregados dos setores permitidos.' } },
    },
  },
  '/api/v1/sectors': {
    get: {
      summary: 'Listar setores autorizados',
      description:
        'Requer Bearer. Pode filtrar por `sectorId`; setores retornados respeitam o escopo do perfil.',
      tags: ['sectors'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Lista de setores.' } },
    },
    post: {
      summary: 'Criar setor',
      description:
        'Requer Bearer e perfil autorizado (Admin ou Ouvidoria). O slug deve conter letras minúsculas, números e hífens.',
      tags: ['sectors'],
      security: [{ bearerAuth: [] }],
      responses: { '201': { description: 'Setor criado.' } },
    },
  },
  '/api/v1/sectors/public': {
    get: {
      summary: 'Listar setores com pesquisa publicada',
      description:
        'Rota pública. Retorna os setores que possuem pesquisa publicada para acesso dos respondentes.',
      tags: ['sectors'],
      responses: { '200': { description: 'Lista pública de setores.' } },
    },
  },
  '/api/v1/surveys': {
    get: {
      summary: 'Listar pesquisas não arquivadas',
      description:
        'Requer Bearer e perfil Admin ou Ouvidoria. Inclui identificação, nome e slug do setor.',
      tags: ['surveys'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Lista de pesquisas não arquivadas.' },
        '403': { description: 'Perfil sem permissão para esta operação.' },
      },
    },
    post: {
      summary: 'Publicar pesquisa',
      description:
        'Requer Bearer e perfil autorizado. A pesquisa é associada a um setor existente.',
      tags: ['surveys'],
      security: [{ bearerAuth: [] }],
      responses: { '201': { description: 'Pesquisa publicada.' } },
    },
  },
  '/api/v1/surveys/{id}': {
    delete: {
      summary: 'Arquivar pesquisa',
      description:
        'Requer Bearer e perfil Admin ou Ouvidoria. Retira a publicação e preserva respostas e indicadores históricos. Repetir o arquivamento retorna 204.',
      tags: ['surveys'],
      security: [{ bearerAuth: [] }],
      responses: {
        '204': { description: 'Pesquisa arquivada; resposta sem corpo.' },
        '400': { description: 'Identificador inválido.' },
        '403': { description: 'Perfil sem permissão para esta operação.' },
        '404': { description: 'Pesquisa não encontrada.' },
      },
    },
  },
  '/api/v1/questions': {
    get: {
      summary: 'Listar perguntas ativas',
      description:
        'Requer Bearer. Retorna perguntas dos setores disponíveis ao perfil autenticado.',
      tags: ['questions'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Lista de perguntas ativas.' } },
    },
    post: {
      summary: 'Criar pergunta de avaliação',
      description:
        'Requer Bearer e acesso ao setor informado. A pergunta pode ser vinculada a um setor ou ser global (`sector_id: null`).',
      tags: ['questions'],
      security: [{ bearerAuth: [] }],
      responses: { '201': { description: 'Pergunta criada.' } },
    },
  },
  '/api/v1/questions/{id}': {
    patch: {
      summary: 'Desativar pergunta',
      description:
        'Requer Bearer e acesso ao setor da pergunta. Envie `{ "active": false }`; o registro é preservado para manter o histórico.',
      tags: ['questions'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Pergunta desativada.' } },
    },
  },
  '/api/v1/settings/notifications': {
    get: {
      summary: 'Consultar configurações de notificação',
      description: 'Requer Bearer. Retorna os endereços e o estado de ativação configurados.',
      tags: ['settings'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Configurações de notificação.' } },
    },
    put: {
      summary: 'Atualizar configurações de notificação',
      description:
        'Requer Bearer. Salva os endereços e o estado de ativação. Esta configuração não envia e-mails por si só.',
      tags: ['settings'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Configurações salvas.' } },
    },
  },
  '/api/v1/complaints': {
    get: {
      summary: 'Listar ocorrências',
      description:
        'Requer Bearer. Aceita filtros por setor e status (`open`, `in_progress`, `closed`), além de paginação (`limit` de 1 a 100, padrão 25; `offset` padrão 0).',
      tags: ['complaints'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Página de ocorrências com `items`, `limit` e `offset`.' },
      },
    },
  },
  '/api/v1/complaints/{id}': {
    patch: {
      summary: 'Atualizar status da ocorrência',
      description:
        'Requer Bearer e acesso ao setor da ocorrência. Status válidos: `open`, `in_progress` e `closed`.',
      tags: ['complaints'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Status atualizado.' },
        '403': { description: 'Perfil sem acesso ao setor da ocorrência.' },
      },
    },
  },
  '/api/v1/reports/responses': {
    get: {
      summary: 'Consultar respostas paginadas',
      description:
        'Requer Bearer. Aceita setor, período ISO 8601, turno e paginação. Respostas e campos de Ouvidoria são limitados pelo perfil autorizado.',
      tags: ['reports'],
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Página de respostas com `items`, `limit` e `offset`.' } },
    },
  },
  '/api/v1/tv/metrics': {
    get: {
      summary: 'Consultar indicadores públicos da TV',
      description:
        'Rota pública. Retorna somente dados agregados, sem expor respostas individuais.',
      tags: ['dashboard'],
      responses: { '200': { description: 'Indicadores agregados.' } },
    },
  },
};

applyRequestSchemas(openApiPaths);
