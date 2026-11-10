# Mini-plano g10: horários, calendário e comunicados

## Objetivo

Dois módulos: agenda (grade de horários das turmas e calendário letivo) e comunicados (avisos para toda a escola, alunos, professores, um curso ou uma turma).

Leia antes: `docs/plano/CONTRATOS.md` (seções 3, 4, 5.9, 5.10, 6, 7 e 8), `server/prisma/schema.prisma` (modelos `HorarioAula`, `EventoCalendario`, `Comunicado`, `ComunicadoLeitura`, `Turma`, `Inscricao`, `Matricula`), e os arquivos reais `server/src/lib/*.ts`, `client/src/lib/*.ts(x)` e `client/src/ui/index.tsx`.

## Arquivos que você pode criar (e só estes)

- `server/src/modules/agenda/routes.ts`
- `server/src/modules/comunicados/routes.ts`
- `client/src/modules/agenda/index.tsx` e outros arquivos nessa pasta
- `client/src/modules/comunicados/index.tsx` e outros arquivos nessa pasta

Você **consome** (não implementa) `GET /turmas`, `GET /turmas/minhas`, `GET /cursos` e `GET /periodos-letivos`.

## Passos do servidor: agenda

1. Implemente todos os endpoints da seção 5.9. Declare `/horarios/meus` antes das rotas com `:id`.
2. Constante `incluirHorario` com o `include` do `HorarioDTO`.
3. Validação: `diaSemana` inteiro de 1 a 7; `horaInicio` e `horaFim` no formato `HH:MM` (regex `^([01]\d|2[0-3]):[0-5]\d$`); `horaFim > horaInicio` comparando as strings (400).
4. Choque em `POST /horarios`: busque os horários do mesmo `diaSemana` em turmas do mesmo `periodoLetivoId`; há sobreposição quando `novo.horaInicio < existente.horaFim && novo.horaFim > existente.horaInicio`; se a turma existente tiver o mesmo `professorId`, 409 `Professor já tem aula nesse horário`; se a sala (do horário, ou a da turma quando o horário não tiver) for igual e não vazia, 409 `Sala ocupada nesse horário`.
5. `GET /horarios/meus`: PROFESSOR = horários de turmas com `professorId` dele e `periodoLetivo.ativo`; ALUNO = horários de turmas com inscrição `CURSANDO` em matrícula do aluno. Ordene por `diaSemana` e `horaInicio`.
6. Calendário: `?de=` e `?ate=` (datas `AAAA-MM-DD`) filtram eventos com `fim >= de` e `inicio <= ate`; sem filtro, devolve todos. `fim >= inicio` (400).

## Passos do servidor: comunicados

1. Implemente todos os endpoints da seção 5.10.
2. Função `visiveisPara(req)` que devolve o `where` do Prisma conforme o parágrafo "Visibilidade" da seção 5.10 (um `OR` de condições; ADMIN e SECRETARIA recebem `{}`). Para ALUNO, carregue antes os `turmaId` das inscrições não trancadas e os `cursoId` das matrículas dele; para PROFESSOR, os `id` das turmas dele e os `cursoId` das disciplinas dessas turmas.
3. `GET /comunicados`: inclua `leituras: { where: { usuarioId: req.usuario.id } }` e transforme em `lido: boolean` (não devolva `leituras`).
4. `POST /comunicados`: `publico: 'TURMA'` exige `turmaId`, `'CURSO'` exige `cursoId` (400). PROFESSOR só pode `TURMA` de turma em que ele é o professor (403). `autorId = req.usuario.id`.
5. `DELETE`: ADMIN ou o autor; senão 403.
6. `POST /comunicados/:id/ler`: `upsert` em `ComunicadoLeitura`.

## Passos do cliente: agenda

1. Componente `GradeHorario` que recebe `HorarioDTO[]` e mostra a semana: a partir de 720 px, uma coluna por dia (segunda a sábado, e domingo só se houver aula) com blocos (hora, disciplina, turma, sala, professor); abaixo disso, uma lista agrupada por dia.
2. Componente `Calendario` que lista os eventos agrupados por mês, com `Selo` por tipo (LETIVO "Letivo" azul, FERIADO "Feriado" vermelho, PROVA "Prova" amarelo, EVENTO "Evento" verde, RECESSO "Recesso" cinza), recebendo uma prop `editavel`.
3. `/admin/horarios` (ADMIN, SECRETARIA, ícone 🕒, ordem 70): `Selecao` de período e campo de grupo para filtrar; `GradeHorario`; "Novo horário" em `Modal` (`Selecao` de turma do período, dia da semana, hora de início e fim com `tipo="time"`, sala); excluir horário. Mostre o erro 409 de choque em `Aviso`.
4. `/admin/calendario` (ADMIN, SECRETARIA, ícone 📅, ordem 71): `Calendario` editável (criar, editar, excluir evento).
5. `/professor/horario` e `/aluno/horario` (ícone 🕒, ordem 70, rótulo "Horário"): `GradeHorario` com `GET /horarios/meus`.
6. `/professor/calendario` e `/aluno/calendario` (ícone 📅, ordem 71): `Calendario` só para leitura.

## Passos do cliente: comunicados

1. Componente `ListaComunicados`: cartões com título, autor, data (`formatarDataHora`), público (TODOS "Toda a escola", ALUNOS "Alunos", PROFESSORES "Professores", TURMA "Turma <código>", CURSO "Curso <nome>"), corpo com quebras de linha preservadas (`white-space: pre-wrap`), marca de "Novo" quando `lido` for `false`. Ao abrir um comunicado não lido, chama `POST /comunicados/:id/ler`.
2. `/admin/comunicados` (ADMIN, SECRETARIA, ícone 📣, ordem 72): `ListaComunicados` + "Novo comunicado" em `Modal` (título, corpo com `AreaTexto`, público, e `Selecao` de turma ou curso conforme o público) + excluir.
3. `/professor/comunicados` (PROFESSOR, ícone 📣, ordem 72): `ListaComunicados` + "Novo comunicado para turma" (`Selecao` com as turmas de `GET /turmas/minhas`).
4. `/aluno/comunicados` (ALUNO, ícone 📣, ordem 72): `ListaComunicados`.

## Critérios de aceite

- Todos os endpoints das seções 5.9 e 5.10 existem com método, caminho, permissão e formato do contrato.
- Dois horários sobrepostos do mesmo professor no mesmo período devolvem 409.
- Aluno não vê comunicado de turma em que não está inscrito.
- `npx tsc --noEmit` em `server` e em `client` sem erro nos seus arquivos.
- Telas usam só componentes de `client/src/ui` e funcionam em 360 px.

## Verificação

Seção 8 do contrato.
