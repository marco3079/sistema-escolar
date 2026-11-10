# Mini-plano g09: financeiro e biblioteca

## Objetivo

Dois módulos independentes: controle de mensalidades e bolsas, e biblioteca (acervo e empréstimos).

Leia antes: `docs/plano/CONTRATOS.md` (seções 3, 4, 5.7, 5.8, 6, 7 e 8), `server/prisma/schema.prisma` (modelos `Mensalidade`, `Bolsa`, `Matricula`, `Curso`, `Livro`, `Emprestimo`), e os arquivos reais `server/src/lib/*.ts`, `client/src/lib/*.ts(x)` e `client/src/ui/index.tsx`.

## Arquivos que você pode criar (e só estes)

- `server/src/modules/financeiro/routes.ts`
- `server/src/modules/biblioteca/routes.ts`
- `client/src/modules/financeiro/index.tsx` e outros arquivos nessa pasta
- `client/src/modules/biblioteca/index.tsx` e outros arquivos nessa pasta

Você **consome** (não implementa) `GET /matriculas` e `GET /usuarios`/`GET /alunos`.

## Passos do servidor: financeiro

1. Implemente todos os endpoints da seção 5.7. Declare `/mensalidades/minhas` e `/mensalidades/gerar` antes das rotas com `:id`.
2. Função `marcarAtrasadas()`: `updateMany` de `ABERTA` com `vencimento < início do dia de hoje` para `ATRASADA`. Chame no começo de `GET /mensalidades`, `GET /mensalidades/minhas` e `GET /financeiro/resumo`.
3. Função `paraDTO(m)` que acrescenta `valorFinal = Math.max(0, m.valor - m.desconto)` arredondado a 2 casas.
4. `POST /mensalidades/gerar`: valide `1 <= mesInicial <= mesFinal <= 12` e `1 <= diaVencimento <= 28`. Para cada mês: `competencia = "AAAA-MM"` (mês com dois dígitos), `vencimento = new Date(ano, mes - 1, diaVencimento)`, `valor = curso.mensalidade`, `desconto` conforme a maior bolsa ativa da matrícula (ativa, `inicio <= vencimento` e `fim` nulo ou `>= vencimento`). `createMany` com `skipDuplicates: true`. 409 `Curso sem mensalidade definida` se `curso.mensalidade <= 0`.
5. `pagar`: 409 se o status for `PAGA` ou `CANCELADA`; grava `status: 'PAGA'`, `pagoEm: new Date()`, `formaPagamento`. `cancelar`: 409 se `PAGA`.
6. Bolsas: `0 < percentual <= 100` (400).
7. `GET /financeiro/resumo`: some `valorFinal` em memória por status; `aberto` = ABERTA, `atrasado` = ATRASADA, `pago` = PAGA; `quantidadeBolsas` = bolsas ativas.
8. `GET /mensalidades/minhas`: mensalidades das matrículas do `req.usuario.alunoId`.

## Passos do servidor: biblioteca

1. Implemente todos os endpoints da seção 5.8. Declare `/emprestimos/meus` antes das rotas com `:id`.
2. `paraDTO(e)` acrescenta `atrasado`.
3. `POST /emprestimos`: `prisma.$transaction`; lê o livro, 409 `Sem exemplares disponíveis` se `disponiveis <= 0`; cria o empréstimo com `devolucaoPrevista = agora + dias`; `disponiveis: { decrement: 1 }`.
4. `devolver`: 409 se já `DEVOLVIDO`; grava `devolvidoEm` e `status`; `disponiveis: { increment: 1 }`.
5. `PUT /livros/:id` com `exemplares`: `disponiveis = Math.max(0, disponiveis + (novo - antigo))`.

## Passos do cliente: financeiro

1. `/admin/financeiro` (ADMIN, SECRETARIA, ícone 💰, ordem 60): cartões de resumo (em aberto, atrasado, recebido, bolsas ativas) e `Abas`:
   - **Mensalidades**: filtros por status e competência; tabela (aluno, curso, competência, vencimento, valor, desconto, valor final, status com `Selo`); ações "Registrar pagamento" (`Modal` com `Selecao` de forma: Dinheiro, Pix, Cartão, Boleto, Transferência) e "Cancelar"; botão "Gerar mensalidades" (`Modal` com matrícula, ano, mês inicial, mês final, dia de vencimento).
   - **Bolsas**: tabela (aluno, curso, nome, percentual, início, fim, ativa), criar, editar, excluir.
2. `/aluno/financeiro` (ALUNO, ícone 💰, ordem 60): lista de `GET /mensalidades/minhas` com total em aberto no topo. Só leitura, com um `Aviso` de que o pagamento é registrado pela secretaria.

Rótulos: ABERTA "Em aberto" (azul), PAGA "Paga" (verde), ATRASADA "Atrasada" (vermelho), CANCELADA "Cancelada" (cinza).

## Passos do cliente: biblioteca

1. Componente `Acervo` (busca + tabela: título, autor, categoria, ano, disponíveis/exemplares) e componente `MeusEmprestimos` (livro, retirada, devolução prevista, situação: "Devolvido", "No prazo" ou "Atrasado").
2. `/admin/biblioteca` (ADMIN, SECRETARIA, ícone 📚, ordem 61) com `Abas`:
   - **Acervo**: `Acervo` com criar, editar e excluir livro.
   - **Empréstimos**: filtro por status; tabela (livro, usuário, perfil, retirada, devolução prevista, situação); "Novo empréstimo" (`Selecao` de livro com disponíveis > 0, `Selecao` de usuário vinda de `GET /usuarios` quando o perfil logado for ADMIN ou de `GET /alunos` quando for SECRETARIA, dias); "Registrar devolução".
3. `/aluno/biblioteca` e `/professor/biblioteca` (ícone 📚, ordem 61): `Abas` "Acervo" (só consulta) e "Meus empréstimos".

## Critérios de aceite

- Todos os endpoints das seções 5.7 e 5.8 existem com método, caminho, permissão e formato do contrato.
- Gerar mensalidades duas vezes para os mesmos meses não duplica.
- Emprestar o último exemplar zera `disponiveis` e o próximo empréstimo devolve 409.
- `npx tsc --noEmit` em `server` e em `client` sem erro nos seus arquivos.
- Telas usam só componentes de `client/src/ui` e funcionam em 360 px.

## Verificação

Seção 8 do contrato.
