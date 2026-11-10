# Mini-plano g06: matrícula

## Objetivo

Matrícula do aluno em um curso, enturmação (regime seriado) e inscrição em disciplinas com vagas e pré-requisitos (regime de créditos).

Leia antes: `docs/plano/CONTRATOS.md` (seções 3, 4, 5.3 (formato `TurmaDTO`), 5.4, 6, 7 e 8), `server/prisma/schema.prisma` (modelos `Matricula`, `Inscricao`, `Turma`, `Disciplina`, `Curso`), e os arquivos reais `server/src/lib/*.ts`, `client/src/lib/*.ts(x)` e `client/src/ui/index.tsx`.

## Arquivos que você pode criar (e só estes)

- `server/src/modules/matricula/routes.ts`
- `client/src/modules/matricula/index.tsx`
- outros arquivos dentro de `client/src/modules/matricula/`

Você **consome** (não implementa) `GET /alunos`, `GET /cursos`, `GET /periodos-letivos` e `GET /turmas`, que são de outros geradores.

## Passos do servidor

1. Implemente todos os endpoints da seção 5.4. Declare `GET /matriculas/minhas` antes de `GET /matriculas/:id`.
2. Constantes `incluirMatricula` e `incluirInscricao` com os `include` de `MatriculaDTO` e `InscricaoDTO`.
3. Função `conferirDono(req, matricula)`: perfis ADMIN e SECRETARIA passam; ALUNO passa só se `matricula.alunoId === req.usuario.alunoId`; PROFESSOR passa só nas rotas de leitura marcadas com P; caso contrário `HttpError(403, 'Sem permissão')`.
4. Função `situacoesDasTurmas(matriculaId, periodoLetivoId)` que devolve as turmas do período cujas disciplinas são do curso da matrícula, cada uma com `situacao` e `pendentes`, seguindo a ordem de regras escrita logo abaixo da tabela da seção 5.4. Carregue de uma vez as inscrições da matrícula (com `turma.disciplinaId` e `turma.periodoLetivoId`) e os pré-requisitos das disciplinas para não fazer consulta dentro de laço.
5. `GET /matriculas/:id/turmas-disponiveis` usa essa função. `POST /inscricoes` também: acha a turma na lista; se não estiver, 404; se `situacao !== 'DISPONIVEL'`, 409 com mensagem em português (ex.: `Pré-requisito pendente: Cálculo I`).
6. `POST /inscricoes` e `enturmar` exigem matrícula `ATIVA` (409 `Matrícula não está ativa`).
7. `POST /matriculas/:id/enturmar`: turmas com `periodoLetivoId`, `grupo` e `disciplina.cursoId` da matrícula; `createMany` com `skipDuplicates: true`; devolve `{ inscritas }` com a quantidade criada.
8. `DELETE /inscricoes/:id`: 409 se o status não for `CURSANDO`; conta notas e presenças da inscrição; zero dos dois apaga, senão atualiza para `TRANCADO`.

## Passos do cliente

Exporte `rotas` com as linhas do g06 na seção 7:

1. `/admin/matriculas` (ADMIN, SECRETARIA, ícone 📝, ordem 30): filtros por curso e status; tabela (RA, aluno, curso, nível, série, ingresso, status com `Selo`). "Nova matrícula" em `Modal` (`Selecao` de aluno, curso, período de ingresso, série). Clique na linha abre o detalhe em `Modal`:
   - dados da matrícula, mudar status e série;
   - lista de inscrições (disciplina, turma, período, status, nota, frequência) com "Remover";
   - se o curso for `SERIADO`: bloco "Enturmar" com `Selecao` de período e campo `grupo`;
   - se for `CREDITOS`: bloco "Inscrever em disciplina" com `Selecao` de período e a lista de turmas disponíveis, cada uma com a situação e o botão "Inscrever" habilitado só em `DISPONIVEL`.
2. `/aluno/matricula` (ALUNO, ícone 📝, ordem 30): cartão para cada matrícula de `GET /matriculas/minhas` (curso, nível, série, status) com as inscrições do período. Para curso `CREDITOS` com matrícula ativa, o mesmo bloco "Inscrever em disciplina" e botão "Cancelar inscrição" nas que estão `CURSANDO`. Para curso `SERIADO`, só exibe (quem enturma é a secretaria).

Rótulos da situação: DISPONIVEL "Disponível", JA_INSCRITO "Já inscrito", JA_APROVADO "Já aprovado", PRE_REQUISITO_PENDENTE "Falta pré-requisito: ..." (com os nomes de `pendentes`), SEM_VAGA "Sem vaga".

## Critérios de aceite

- Todos os endpoints da seção 5.4 existem com método, caminho, permissão e formato do contrato.
- Aluno não consegue ler nem alterar matrícula de outro aluno (403).
- `npx tsc --noEmit` em `server` e em `client` sem erro nos seus arquivos.
- Telas usam só componentes de `client/src/ui` e funcionam em 360 px.

## Verificação

Seção 8 do contrato.
