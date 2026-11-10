# Plano do sistema escolar

**Estado: em execução. Veja a tabela "Andamento" no fim.**

## Pedido

Sistema escolar completo, do ensino fundamental ao doutorado, rodando no Docker, com repositório público no GitHub.

## Decisões do usuário (popup de 10/11/2026)

- Tecnologia: Node + React + PostgreSQL (API Express/Prisma em TypeScript, tela React/Vite).
- Módulos: cadastros e acesso, matrícula e vida acadêmica, notas/frequência/boletim, pós-graduação, financeiro, horários e calendário, biblioteca, comunicados.
- Três versões: aluno, professor e administrativo.
- Versão para celular acessível pela web (app responsivo e instalável como PWA).
- Dados de demonstração fictícios com usuários de teste.
- Repositório público `sistema-escolar` na conta `marco3079`, licença MIT.

## Decisões do main

- Um único app web com três portais (`/admin`, `/professor`, `/aluno`) escolhidos pelo perfil no login.
- Perfis de acesso: ADMIN, SECRETARIA, PROFESSOR, ALUNO. O responsável do aluno é só um dado de contato no cadastro (sem login próprio).
- Financeiro é controle interno: sem boleto nem cobrança real.
- Regras de aprovação: frequência mínima 75%; média mínima 6 (básico, técnico e graduação) e 7 (pós).
- O servidor roda com `tsx`, e o banco é criado com `prisma db push` na subida do contêiner.
- Contratos por extenso: [CONTRATOS.md](CONTRATOS.md) e `server/prisma/schema.prisma` (escritos pelo main).

## Fases

Sala do squad: `sistema_escolar`. Revisor único (`revisor`) valida cada entrega.

### Fase A: fundação (3 geradores em paralelo)

| Gerador | Mini-plano | Entrega |
|---|---|---|
| g01 | [g01-base-servidor.md](g01-base-servidor.md) | Esqueleto da API, autenticação, painel, código compartilhado |
| g02 | [g02-base-cliente.md](g02-base-cliente.md) | Esqueleto do app web, login, layout dos três portais, componentes, PWA |
| g03 | [g03-infra.md](g03-infra.md) | Docker Compose, Dockerfiles, nginx, README, licença, `.gitignore` |

A fase B só começa com g01 e g02 aprovados, porque os módulos usam o código compartilhado deles.

### Fase B: módulos (8 geradores em paralelo)

| Gerador | Mini-plano | Entrega |
|---|---|---|
| g04 | [g04-cadastros.md](g04-cadastros.md) | Alunos, professores, usuários, meu perfil |
| g05 | [g05-academico.md](g05-academico.md) | Cursos, disciplinas, períodos letivos, turmas |
| g06 | [g06-matricula.md](g06-matricula.md) | Matrículas, enturmação, inscrição em disciplinas |
| g07 | [g07-diario.md](g07-diario.md) | Avaliações, notas, frequência, fechamento, boletim, histórico |
| g08 | [g08-pos.md](g08-pos.md) | Projetos de pesquisa, orientação, bancas |
| g09 | [g09-financeiro-biblioteca.md](g09-financeiro-biblioteca.md) | Mensalidades, bolsas, acervo, empréstimos |
| g10 | [g10-agenda-comunicados.md](g10-agenda-comunicados.md) | Horários, calendário, comunicados |
| g01 (2ª tarefa) | [g01b-seed.md](g01b-seed.md) | Dados de demonstração |

### Fase C: integração (main)

1. `docker compose up --build` e conferir que os três contêineres sobem.
2. Teste de ponta a ponta com os usuários de demonstração: login nos três portais, uma operação de cada módulo, telas em largura de celular.
3. Defeitos encontrados voltam ao gerador dono do arquivo, com plano de ajuste, e passam de novo pelo revisor.
4. `git init`, primeiro commit, criar o repositório público `marco3079/sistema-escolar` e enviar.
5. Encerrar a sala e entregar o resumo.

## Regra de arquivos

Dois geradores nunca editam o mesmo arquivo. Cada mini-plano traz a lista fechada de arquivos do gerador. `schema.prisma` e `CONTRATOS.md` são do main.

## Andamento

| Parte | Estado |
|---|---|
| Contratos e schema | feito |
| Mini-planos | feito |
| Fase A | aprovada pelo revisor (g01 com um ajuste em `app.ts`, g02, g03) |
| Fase B | aprovada pelo revisor (seed e g10 com um ajuste cada) |
| Fase C | concluída: Docker no ar, 169 verificações da API sem falha, telas conferidas em celular e desktop |
