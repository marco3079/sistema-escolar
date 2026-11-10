# Mini-plano g07: diário, notas, frequência, boletim e histórico

## Objetivo

O professor lança avaliações, notas e presenças e fecha a turma. O aluno vê boletim e histórico. A secretaria consulta boletim e histórico de qualquer matrícula.

Leia antes: `docs/plano/CONTRATOS.md` (seções 3, 4, 5.3 (formato `TurmaDTO`), 5.4 (formato `MatriculaDTO`), 5.5, 6, 7 e 8), `server/prisma/schema.prisma` (modelos `Turma`, `Inscricao`, `Avaliacao`, `Nota`, `Aula`, `Presenca`, `Matricula`), e os arquivos reais `server/src/lib/*.ts` (principalmente `regras.ts`), `client/src/lib/*.ts(x)` e `client/src/ui/index.tsx`.

## Arquivos que você pode criar (e só estes)

- `server/src/modules/diario/routes.ts`
- `server/src/modules/diario/calculo.ts`
- `client/src/modules/diario/index.tsx`
- outros arquivos dentro de `client/src/modules/diario/`

Atenção: os caminhos `/turmas/:id/diario`, `/turmas/:id/avaliacoes`, `/turmas/:id/aulas`, `/turmas/:id/fechar` e `/turmas/:id/reabrir` são seus; `/turmas`, `/turmas/minhas` e `/turmas/:id` são do g05. Não os implemente.

## Passos do servidor

1. `calculo.ts`:
   - `export async function recalcularInscricoes(inscricaoIds: number[]): Promise<void>` aplicando a regra "Recalcular uma inscrição" da seção 5.5 (não muda `status`);
   - `export async function recalcularTurma(turmaId: number): Promise<void>` que recalcula todas as inscrições da turma.
2. Função `carregarTurmaDoProfessor(req, turmaId, { leituraSecretaria })`: busca a turma (404 se não existir); ADMIN passa; SECRETARIA passa só quando `leituraSecretaria` for `true`; PROFESSOR passa só se `turma.professorId === req.usuario.professorId`; senão 403. Para rotas por avaliação ou aula, descubra a turma pelo registro e use a mesma função.
3. Implemente todos os endpoints da seção 5.5 com as permissões da tabela.
4. `GET /turmas/:id/diario`: uma resposta com `turma` (mesmo `include` do `TurmaDTO`), `inscricoes` (sem `TRANCADO`, ordenadas pelo nome do aluno, no formato `{ id, status, notaFinal, frequencia, aluno: { ra, nome } }`), `avaliacoes` por data, `notas` de todas as avaliações da turma, `aulas` por data.
5. `PUT /avaliacoes/:id/notas`: valide `0 <= valor <= notaMaxima` (400); cada `inscricaoId` precisa ser da mesma turma (400); `upsert` por `avaliacaoId_inscricaoId`; depois `recalcularInscricoes`.
6. Aulas: `POST` cria a aula e as presenças na mesma transação; `PUT` atualiza `data`/`conteudo`, apaga as presenças da aula e recria; `DELETE` apaga (cascata nas presenças). Sempre termine com `recalcularTurma`.
7. `POST /turmas/:id/fechar`: `recalcularTurma`; para cada inscrição `CURSANDO`, `status = calcularSituacao(nivel do curso, notaFinal ?? 0, frequencia ?? 100)`. Devolve as inscrições no formato do diário.
8. `POST /turmas/:id/reabrir` (só ADMIN): inscrições `APROVADO`, `REPROVADO_NOTA` e `REPROVADO_FALTA` da turma voltam para `CURSANDO`.
9. Boletim e histórico: declare `/boletim/meu` e `/historico/meu` antes das rotas com `:matriculaId`. Nas rotas "meu", a matrícula é a de `?matriculaId=` (403 se não for do aluno logado) ou a primeira `ATIVA` do aluno (404 `Nenhuma matrícula encontrada` se não houver). Monte `BoletimDTO` e `HistoricoDTO` exatamente como na seção 5.5. O histórico não lista inscrições `TRANCADO`; `creditosConcluidos` e `cargaHorariaConcluida` somam só as `APROVADO`.

## Passos do cliente

Exporte `rotas` com as linhas do g07 na seção 7:

1. `/professor/diario/:turmaId` (PROFESSOR, ADMIN, SECRETARIA; `menu: false`; rótulo "Diário"; ícone 📒): cabeçalho com disciplina, turma e período, e `Abas`:
   - **Notas**: lista de avaliações (criar, editar, excluir em `Modal`); ao escolher uma avaliação, lista de alunos com um `Campo` numérico por aluno e botão "Salvar notas" (`PUT /avaliacoes/:id/notas`). Mostra a média parcial de cada aluno.
   - **Frequência**: lista de aulas (data, conteúdo, presentes/total); "Nova aula" abre `Modal` com data, conteúdo e uma `Caixa` "presente" por aluno (todas marcadas por padrão); clicar numa aula abre para editar (`GET /aulas/:id`).
   - **Fechamento**: tabela (RA, aluno, nota final, frequência, situação com `Selo`) e botão "Fechar turma" com `window.confirm`.
2. `/aluno/boletim` (ALUNO, ícone 📊, ordem 40): `GET /boletim/meu`; se o aluno tiver mais de uma matrícula (`GET /matriculas/minhas`), `Selecao` para trocar. Um `Cartao` por período com a tabela de disciplinas (disciplina, cada avaliação com a nota, média, frequência, situação).
3. `/aluno/historico` (ALUNO, ícone 📜, ordem 41): `GET /historico/meu` com tabela e um cartão de resumo (créditos concluídos, carga horária concluída, coeficiente).
4. `/admin/boletins` (ADMIN, SECRETARIA, ícone 📊, ordem 40): `Selecao` de matrícula (`GET /matriculas`, rótulo "RA - aluno - curso") e `Abas` "Boletim" e "Histórico" reutilizando os mesmos componentes.

Rótulos de situação: CURSANDO "Cursando" (azul), APROVADO "Aprovado" (verde), REPROVADO_NOTA "Reprovado por nota" (vermelho), REPROVADO_FALTA "Reprovado por falta" (vermelho), TRANCADO "Trancado" (cinza).

## Critérios de aceite

- Todos os endpoints da seção 5.5 existem com método, caminho, permissão e formato do contrato.
- Professor não acessa diário de turma de outro professor (403).
- Nota fora de `0..notaMaxima` devolve 400.
- `npx tsc --noEmit` em `server` e em `client` sem erro nos seus arquivos.
- Telas usam só componentes de `client/src/ui` e funcionam em 360 px (a grade de notas pode rolar dentro do próprio cartão, nunca a página).

## Verificação

Seção 8 do contrato.
