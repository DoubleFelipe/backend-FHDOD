# Migração do Supabase para API/Aiven

## Diferença conhecida

`supabase/migrations/202610020001_initial_schema.sql` não estava neste repositório. O esquema daqui foi desenhado como primeira versão com base no plano e não deve ser considerado compatível sem comparação. Revise a migration original, políticas RLS, RPCs, funções e Edge Functions antes de importar dados.

## Identidade e dados

A API mantém identidades UUID próprias e hashes Argon2id. Não copie hashes do Supabase Auth nem presuma que os IDs podem ser reutilizados. Defina uma migração explícita de contas, como convite/reset verificado ou uma migração de hash revisada. Crie o primeiro administrador por procedimento controlado; não há usuário ou senha padrão. Exporte e valide perfis (sem senhas), setores, gestores, pesquisas, perguntas, respostas, notas, ocorrências e configurações em staging. Compare contagens, integridade, agregados, estados e amostras de texto antes de produção.

## Cutover e rollback

1. Restaure um snapshot sanitizado num staging isolado e aplique as migrations desde um banco vazio.
2. Reconcilie dados e execute testes de integração somente no staging.
3. Configure a CA TLS da Aiven, usuários de runtime e migration com privilégios mínimos, origem do frontend, segredos, worker de e-mail e monitoramento.
4. Congele escritas ou faça uma exportação delta planejada; tire snapshot recuperável, importe e reconcilie.
5. Aponte o frontend para a API, monitore saúde, erros e latência, e mantenha o sistema antigo somente leitura durante a janela de rollback acordada.
6. Para reverter, redirecione o frontend ao sistema antigo e reconcilie as escritas feitas após o cutover. Não replique escritas automaticamente.

Esta implementação não copiou dados, configurou Aiven nem realizou cutover.
