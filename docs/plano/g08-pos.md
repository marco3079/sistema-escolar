# Mini-plano g08: pós-graduação

## Objetivo

Acompanhar o aluno de especialização, mestrado e doutorado: projeto de pesquisa, orientador e coorientador, bancas de qualificação e de defesa.

Leia antes: `docs/plano/CONTRATOS.md` (seções 3, 4, 5.6, 6, 7 e 8), `server/prisma/schema.prisma` (modelos `ProjetoPesquisa`, `Banca`, `BancaMembro`, `Matricula`, `Professor`), e os arquivos reais `server/src/lib/*.ts` (`ehPos` em `regras.ts`), `client/src/lib/*.ts(x)` e `client/src/ui/index.tsx`.

## Arquivos que você pode criar (e só estes)

- `server/src/modules/pos/routes.ts`
- `client/src/modules/pos/index.tsx`
- outros arquivos dentro de `client/src/modules/pos/`

Você **consome** (não implementa) `GET /matriculas` e `GET /professores`.

## Passos do servidor

1. Implemente todos os endpoints da seção 5.6.
2. Constante `incluirProjeto` com o `include` do `ProjetoDTO` (bancas por data, membros com `professor: { include: { usuario: { select: { nome: true } } } }`).
3. Função `filtroDoUsuario(req)` que devolve o `where` do Prisma: `{}` para ADMIN e SECRETARIA; `{ OR: [{ orientadorId }, { coorientadorId }] }` com o `professorId` do usuário para PROFESSOR; `{ matricula: { alunoId } }` para ALUNO. Use em `GET /pos/projetos` e, em `GET /pos/projetos/:id`, busque com `where: { id, ...filtro }` e devolva 404 se não achar.
4. `POST /pos/projetos`: carrega a matrícula com o curso; 409 `Curso não é de pós-graduação` se `!ehPos(curso.nivel)`; 409 `Matrícula já possui projeto` se existir; `orientadorId` e `coorientadorId` não podem ser iguais (400).
5. `PUT /pos/projetos/:id`: ADMIN e SECRETARIA mudam qualquer campo do corpo; ALUNO dono muda só `titulo`, `resumo` e `linhaPesquisa` (se mandar outro campo, 403); PROFESSOR recebe 403.
6. Bancas: valide os membros (cada um com `professorId` **ou** `nomeExterno`, nunca os dois nem nenhum; 400). Pelo menos um membro com papel `PRESIDENTE` (400).
7. `POST /pos/projetos/:id/bancas` com `tipo: 'DEFESA'` em curso `MESTRADO` ou `DOUTORADO` exige projeto `QUALIFICADO` (409 `O projeto precisa estar qualificado antes da defesa`).
8. `PUT /pos/bancas/:id`: se vier `membros`, apaga os atuais e recria na mesma transação. Se vier `resultado`, aplique a regra de status do projeto escrita abaixo da tabela da seção 5.6, na mesma transação.

## Passos do cliente

Exporte `rotas` com as linhas do g08 na seção 7. Faça um componente `DetalheProjeto` reutilizado nas três telas (dados do projeto, orientador, coorientador, status com `Selo`, lista de bancas com tipo, data, local, resultado, parecer e membros), recebendo uma prop que diz o que pode ser editado.

1. `/admin/pos` (ADMIN, SECRETARIA, ícone 🔬, ordem 50, rótulo "Pós-graduação"): filtro por status; tabela (aluno, curso, nível, título, orientador, status). "Novo projeto" em `Modal`: `Selecao` de matrícula (só as de cursos ESPECIALIZACAO, MESTRADO, DOUTORADO, filtrando `GET /matriculas` no cliente), orientador, coorientador opcional, título, resumo (`AreaTexto`), linha de pesquisa. No detalhe: editar projeto, "Agendar banca" (tipo, data com `datetime-local`, local, membros adicionados um a um: interno com `Selecao` de professor ou externo com nome e instituição, e papel), "Registrar resultado" (resultado e parecer), excluir banca.
2. `/professor/orientacoes` (PROFESSOR, ícone 🔬, ordem 50, rótulo "Orientações"): cartões dos projetos em que é orientador ou coorientador; abre o `DetalheProjeto` só para leitura.
3. `/aluno/pesquisa` (ALUNO, ícone 🔬, ordem 50, rótulo "Pesquisa"): mostra o projeto do aluno com o `DetalheProjeto`; permite editar título, resumo e linha de pesquisa. Sem projeto, mostra `<Aviso tipo="info">` explicando que o projeto de pesquisa é cadastrado pela secretaria para cursos de pós-graduação.

Rótulos: status EM_ELABORACAO "Em elaboração" (cinza), QUALIFICADO "Qualificado" (azul), APROVADO "Aprovado" (verde), REPROVADO "Reprovado" (vermelho). Banca QUALIFICACAO "Qualificação", DEFESA "Defesa". Resultado PENDENTE "Pendente", APROVADO "Aprovado", APROVADO_COM_RESSALVAS "Aprovado com ressalvas", REPROVADO "Reprovado". Papel PRESIDENTE "Presidente", INTERNO "Membro interno", EXTERNO "Membro externo", SUPLENTE "Suplente".

## Critérios de aceite

- Todos os endpoints da seção 5.6 existem com método, caminho, permissão e formato do contrato.
- Aluno e professor não leem projeto que não é deles.
- As três regras de transição de status funcionam.
- `npx tsc --noEmit` em `server` e em `client` sem erro nos seus arquivos.
- Telas usam só componentes de `client/src/ui` e funcionam em 360 px.

## Verificação

Seção 8 do contrato.
