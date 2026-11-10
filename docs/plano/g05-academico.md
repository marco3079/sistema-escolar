# Mini-plano g05: estrutura acadêmica

## Objetivo

Módulo de cursos (do fundamental ao doutorado), disciplinas com pré-requisitos, períodos letivos e turmas.

Leia antes: `docs/plano/CONTRATOS.md` (seções 3, 4, 5.3, 6, 7 e 8), `server/prisma/schema.prisma` (modelos `Curso`, `Disciplina`, `PeriodoLetivo`, `Turma`), e os arquivos reais `server/src/lib/*.ts`, `client/src/lib/*.ts(x)` e `client/src/ui/index.tsx`.

## Arquivos que você pode criar (e só estes)

- `server/src/modules/academico/routes.ts`
- `client/src/modules/academico/index.tsx`
- outros arquivos dentro de `client/src/modules/academico/`

## Passos do servidor

1. Implemente todos os endpoints da seção 5.3 com as permissões da tabela.
2. Declare `GET /turmas/minhas` **antes** de `GET /turmas/:id`.
3. Crie uma constante `incluirTurma` com o `include` do `TurmaDTO` e use em todas as respostas de turma.
4. `GET /turmas/minhas`: `where: { professorId: req.usuario.professorId }`; se `professorId` for `null`, devolva `[]`.
5. Disciplinas: `preRequisitoIds` vira `preRequisitos: { connect: ids.map(id => ({ id })) }` na criação e `{ set: ... }` na edição. Uma disciplina não pode ser pré-requisito dela mesma (400).
6. Filtros de query (`nivel`, `ativo`, `cursoId`, `periodoLetivoId`, `professorId`, `grupo`) são opcionais; converta números com `Number` e ignore valores vazios. `?cursoId=` em turmas filtra por `disciplina: { cursoId }`.
7. Conflitos: código de curso ou de disciplina repetido devolve 409; turma com `codigo` repetido no mesmo período devolve 409; excluir disciplina com turmas ou turma com inscrições devolve 409 com mensagem clara.
8. Datas de período (`inicio`, `fim`) chegam como `"AAAA-MM-DD"`; `fim` precisa ser depois de `inicio` (400).

## Passos do cliente

Exporte `rotas` com as linhas do g05 na seção 7:

1. `/admin/cursos` (ADMIN, SECRETARIA, ícone 🏫, ordem 20): filtro por nível (`NIVEIS`), tabela (código, nome, nível com `rotuloNivel`, regime, duração, mensalidade com `formatarMoeda`, situação). Modal de criar/editar. Clique na linha abre o detalhe do curso num `Modal` grande com a lista de disciplinas agrupada por `periodoSugerido`, e criar/editar/excluir disciplina (nome, código, carga horária, créditos, período sugerido, obrigatória, pré-requisitos escolhidos entre as outras disciplinas do curso com uma lista de `Caixa`).
2. `/admin/periodos` (ADMIN, SECRETARIA, ícone 🗓️, ordem 21, rótulo "Períodos letivos"): tabela (nome, ano, tipo, início, fim, ativo), criar/editar, ativar/desativar.
3. `/admin/turmas` (ADMIN, SECRETARIA, ícone 👥, ordem 22): filtros por período e curso; tabela (código, disciplina, curso, professor, grupo, sala, inscritos/vagas). Modal de criar/editar: `Selecao` de período, curso (só para filtrar as disciplinas), disciplina, professor (`GET /professores`), e campos código, grupo, vagas, sala.
4. `/professor/turmas` (PROFESSOR, ícone 👥, ordem 10, rótulo "Minhas turmas"): `GET /turmas/minhas` em `Grade` de cartões (disciplina, código, curso, período, inscritos), cada um com um link (`Link` do react-router-dom) "Abrir diário" para `/professor/diario/<id da turma>`.

## Critérios de aceite

- Todos os endpoints da seção 5.3 existem com método, caminho, permissão e formato do contrato (`TurmaDTO` idêntico).
- `npx tsc --noEmit` em `server` e em `client` sem erro nos seus arquivos.
- Telas usam só componentes de `client/src/ui` e funcionam em 360 px.

## Verificação

Seção 8 do contrato.
