# Contribuição

Use GitFlow simplificado: `main` contém versões estáveis; `develop` integra mudanças aceitas; branches de trabalho usam `feature/*`, `bugfix/*` ou `hotfix/*`. Não faça commits diretamente em branches protegidas. Siga Conventional Commits, por exemplo `feat(auth): adiciona renovação de token`, `fix(responses): torna submissão idempotente`, `docs(api): documenta endpoint de métricas` e `test(auth): cobre bloqueio por setor`.

Pull requests devem descrever objetivo, critérios de aceite, impacto na API/esquema, migrations e rollback, evidências de lint/typecheck/testes/build, configuração e revisão necessária. Exija revisão para autenticação, autorização, migrations e dados pessoais. Nunca inclua `.env` real ou dados de produção.
