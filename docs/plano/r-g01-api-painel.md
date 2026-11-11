# Mini-plano g01: API do painel e da busca

## Objetivo

Criar o módulo `painel` do servidor, com dois endpoints novos que alimentam a tela inicial redesenhada e o campo de busca do topo.

Leia antes: `docs/plano/redesenho.md` (seção "Contrato de API", que traz o formato exato das respostas e as tabelas por perfil), `docs/plano/CONTRATOS.md` seções 3 e 4, `server/prisma/schema.prisma`, os arquivos reais de `server/src/lib/` e, como exemplo de módulo, `server/src/modules/biblioteca/routes.ts`.

## Arquivo que você pode criar (e só este)

- `server/src/modules/painel/routes.ts`

Não edite `server/src/modules/auth/routes.ts` (o `GET /painel` antigo continua lá) nem nenhum outro arquivo.

## Passos

1. `const router = Router(); export default router;` como nos outros módulos. Os caminhos são `/painel/resumo` e `/busca`.
2. Funções auxiliares no mesmo arquivo:
   - `formatarInteiro(n)`: `n.toLocaleString('pt-BR')`.
   - `formatarDecimal(n, casas)`: `n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })`.
   - `media(valores: number[]): number | null` (null para lista vazia).
   - `rotuloNivel(nivel)`: FUNDAMENTAL_1 "Fundamental I", FUNDAMENTAL_2 "Fundamental II", MEDIO "Ensino Médio", TECNICO "Técnico", GRADUACAO "Graduação", ESPECIALIZACAO "Especialização", MESTRADO "Mestrado", DOUTORADO "Doutorado".
3. `GET /painel/resumo`:
   - `primeiroNome`: busque o usuário por `req.usuario.id` e pegue a primeira palavra do nome.
   - `cartoes`: os quatro do perfil, na ordem e com `chave`, `rotulo`, `icone` e `cor` da tabela do contrato. Valores inteiros com `formatarInteiro`; frequência como `formatarDecimal(x, 1) + '%'`; média geral como `formatarDecimal(x, 1)`; `"—"` quando não houver dado.
   - `variacao`: regra do contrato, só no cartão "Alunos matriculados"; arredonde a 1 casa.
   - `desempenho`: monte a lista dos últimos 12 meses (do mais antigo até o mês atual) com `mes` "AAAA-MM" e `rotulo` em português abreviado ("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"). Carregue de uma vez as notas com `avaliacao: { select: { data, notaMaxima, turmaId } }` no intervalo, filtrando pelo escopo do perfil (PROFESSOR: `avaliacao.turma.professorId`; ALUNO: `inscricao.matricula.alunoId`), agrupe em memória pelo mês de `avaliacao.data` (use `getUTCFullYear` e `getUTCMonth`) e calcule a média de `valor / notaMaxima * 100`, 1 casa. Mês sem nota: `valor: null`.
   - `destaque`: conforme a tabela do contrato. Para "turma com mais inscrições", ordene por `inscricoes: { _count: 'desc' }` e pegue a primeira.
   - PROFESSOR sem `professorId` ou ALUNO sem `alunoId`: cartões com `"0"` ou `"—"`, `desempenho` com todos os valores `null`, `destaque: null`.
4. `GET /busca`:
   - `q = String(req.query.q ?? '').trim()`; menos de 2 caracteres devolve `[]`.
   - Para cada tipo do perfil (tabela do contrato), `findMany` com `contains` e `mode: 'insensitive'`, `take: 4`.
   - Monte os itens `{ tipo, titulo, subtitulo, caminho }` na ordem Aluno, Professor, Turma, Curso, Livro.
   - Nunca devolva e-mail, CPF, telefone nem `senhaHash`.
5. Rode a verificação.

## Critérios de aceite

- Os dois endpoints existem, exigem login (o `app.ts` já aplica `autenticar`) e devolvem exatamente o formato do contrato.
- `cartoes` tem sempre 4 itens; `desempenho` tem sempre 12.
- ALUNO não recebe dados de outros alunos em nenhum dos dois endpoints; PROFESSOR só vê as próprias turmas na busca.
- `cd server && npx tsc --noEmit` com zero erro.

## Verificação

```
cd server
npx tsc --noEmit
```

Não rode `npm install`, não suba banco nem Docker (o contêiner do sistema está no ar; não mexa nele).
