# Modelo de dados

O esquema inicial está em `database/migrations/001_initial.sql`. PostgreSQL relacional atende às relações estáveis e às regras de integridade: perfis associam-se a setores por `sector_managers`; pesquisas pertencem a setores; perguntas podem ser globais ou específicas; respostas pertencem a pesquisas; notas referenciam perguntas e guardam o texto exibido; ocorrências pertencem a respostas; tarefas de notificação referenciam ocorrências.

IDs são UUID. Datas usam `TIMESTAMPTZ` e representam instantes UTC. Nomes seguem `snake_case`; chaves estrangeiras preservam o histórico. Um índice parcial limita a uma pesquisa publicada por setor. Escalas e estados usam constraints e enums. Há índices para consultas de respostas, perguntas ativas, ocorrências e tarefas.

Provisione usuários separados para runtime e migrations na Aiven. O runtime precisa apenas de SELECT/INSERT/UPDATE nas tabelas necessárias e não deve ter privilégios DDL. O usuário de migration aplica DDL. O executor usa `MIGRATION_DATABASE_URL`.

O SQL original do Supabase não estava neste checkout. Compare nomes de colunas, semântica da pergunta NPS, histórico de publicação, retenção, destinatários de notificação e opcionalidade da ouvidoria antes da migração.
