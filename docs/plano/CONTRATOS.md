# Contratos do sistema escolar

Este arquivo e o `server/prisma/schema.prisma` são a fonte da verdade. Todo gerador lê os dois antes de escrever código. Nenhum gerador altera estes dois arquivos; faltou algo, pergunte ao `@main` na sala.

## 1. Visão geral

- Sistema escolar que cobre do ensino fundamental ao doutorado (enum `NivelEnsino`).
- Três portais no mesmo app web, escolhidos pelo perfil do usuário:
  - **Administrativo**: perfis `ADMIN` e `SECRETARIA`, rotas `/admin/...`
  - **Professor**: perfil `PROFESSOR`, rotas `/professor/...`
  - **Aluno**: perfil `ALUNO`, rotas `/aluno/...`
- O app é responsivo (celular primeiro) e instalável no celular como PWA.
- Idioma de telas, mensagens, nomes de variáveis de domínio e rotas: português do Brasil.

## 2. Pastas e tecnologias

```
sistema_escolar/
  docker-compose.yml
  server/                      API (Node 20, TypeScript, Express 4, Prisma 5, zod, JWT)
    prisma/schema.prisma       contrato de dados (main)
    prisma/seed.ts             dados de demonstração
    src/server.ts              sobe o Express
    src/app.ts                 monta middlewares e carrega os módulos
    src/lib/                   código compartilhado (seção 4)
    src/modules/<modulo>/routes.ts   um arquivo de rotas por módulo
  client/                      Web (React 18, TypeScript, Vite 5, react-router-dom 6)
    src/main.tsx, src/App.tsx
    src/lib/                   código compartilhado (seção 6)
    src/ui/                    componentes visuais compartilhados (seção 6)
    src/modules/<modulo>/index.tsx   telas de cada módulo
```

Versões fixas (ninguém adiciona dependência fora desta lista):

- server: `express@4.22.3`, `@prisma/client@5.22.0`, `prisma@5.22.0`, `zod@4.6.7`, `bcryptjs@2.4.3`, `jsonwebtoken@9.0.2`, `cors@2.8.5`, `tsx@4.23.15`, `typescript@5.6.3`, `@types/express@4.17.21`, `@types/node@20.17.6`, `@types/bcryptjs@2.4.6`, `@types/jsonwebtoken@9.0.7`, `@types/cors@2.8.17`
- client: `react@18.3.1`, `react-dom@18.3.1`, `react-router-dom@6.30.6`, `vite@5.4.21`, `@vitejs/plugin-react@4.3.3`, `typescript@5.6.3`, `@types/react@18.3.12`, `@types/react-dom@18.3.1`

O servidor roda com `tsx` (sem passo de build). `tsconfig` do server: `module: commonjs`, `strict: true`, `esModuleInterop: true`.

## 3. Regras gerais da API

- Prefixo de tudo: `/api`. Corpo e resposta em JSON.
- Autenticação: cabeçalho `Authorization: Bearer <jwt>`. Tudo exige login, menos `POST /api/auth/login` e `GET /api/saude`.
- Erro: status HTTP adequado e corpo `{ "erro": "mensagem em português", "detalhes"?: any }`.
  - 400 validação, 401 sem login, 403 sem permissão, 404 não encontrado, 409 conflito de regra.
- Listas devolvem um array JSON simples (sem paginação). Filtros vão na query string.
- Datas trafegam como string ISO. Dinheiro é `number` em reais.
- IDs são inteiros. Parâmetro `:id` inválido (não numérico) devolve 400.
- Criação devolve 201 com o registro criado. Exclusão devolve 204 sem corpo.

## 4. Código compartilhado do servidor (`server/src/lib/`, feito pelo g01)

```ts
// lib/prisma.ts
export const prisma: PrismaClient;

// lib/erros.ts
export class HttpError extends Error { constructor(public status: number, mensagem: string, public detalhes?: unknown) }
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler;
export function idParam(req: Request, nome?: string): number; // lê req.params[nome ?? 'id'], lança HttpError(400) se não for inteiro
export function validar<T>(schema: z.ZodType<T>, dados: unknown): T; // lança HttpError(400, 'Dados inválidos', issues)

// lib/auth.ts
export interface UsuarioToken { id: number; perfil: Perfil; alunoId: number | null; professorId: number | null }
export function autenticar: RequestHandler;                 // preenche req.usuario ou 401
export function permitir(...perfis: Perfil[]): RequestHandler; // 403 se req.usuario.perfil não estiver na lista
export function gerarToken(u: UsuarioToken): string;
// req.usuario é declarado em Express.Request (sempre presente depois de `autenticar`)

// lib/regras.ts
export const FREQUENCIA_MINIMA = 75;
export function mediaMinima(nivel: NivelEnsino): number; // 7 para ESPECIALIZACAO, MESTRADO, DOUTORADO; 6 para os demais
export function calcularSituacao(nivel: NivelEnsino, notaFinal: number, frequencia: number): StatusInscricao;
// frequencia < 75 -> REPROVADO_FALTA; senão notaFinal < mediaMinima -> REPROVADO_NOTA; senão APROVADO
export function ehPos(nivel: NivelEnsino): boolean; // ESPECIALIZACAO, MESTRADO, DOUTORADO
```

### Como um módulo se registra

Cada módulo é a pasta `server/src/modules/<modulo>/` com um `routes.ts` que faz `export default router` (um `express.Router()`). O `app.ts` percorre as pastas de `modules` em ordem alfabética e faz `app.use('/api', autenticar, router)`. Os caminhos dentro do router são completos a partir de `/api` (ex.: `router.get('/alunos', ...)`).

Dentro de um router, rotas fixas (`/turmas/minhas`) são declaradas **antes** das rotas com parâmetro (`/turmas/:id`).

Modelo de rota:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';

const router = Router();

router.get('/livros', asyncHandler(async (req, res) => {
  res.json(await prisma.livro.findMany({ orderBy: { titulo: 'asc' } }));
}));

export default router;
```

## 5. Endpoints

Abreviações de permissão: **A** = ADMIN, **S** = SECRETARIA, **P** = PROFESSOR, **L** = ALUNO, **todos** = qualquer usuário logado.

### 5.1 Base (módulo `auth`, g01)

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/saude` | público | | `{ ok: true }` |
| POST `/auth/login` | público | `{ email, senha }` | `{ token, usuario }` onde `usuario = { id, nome, email, perfil, alunoId, professorId }`; 401 se inválido ou inativo |
| GET `/auth/me` | todos | | `usuario` (mesmo formato) |
| POST `/auth/trocar-senha` | todos | `{ senhaAtual, novaSenha }` (mín. 6) | 204 |
| GET `/painel` | todos | | `{ cartoes: { rotulo: string, valor: string \| number }[] }` conforme o perfil |

Cartões do painel: A/S = alunos ativos, professores, cursos ativos, turmas em períodos ativos, mensalidades em aberto (quantidade). P = minhas turmas (períodos ativos), meus alunos (inscrições CURSANDO nelas), orientações. L = disciplinas cursando, mensalidades em aberto, empréstimos ativos, comunicados não lidos (use contagem simples de comunicados com público TODOS ou ALUNOS sem leitura do usuário).

### 5.2 Cadastros (módulo `cadastros`, g04)

Formato `AlunoDTO`: registro `Aluno` + `usuario: { id, nome, email, cpf, telefone, ativo }`. `ProfessorDTO` é análogo. Nunca devolver `senhaHash`.

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/usuarios` | A | `?perfil=&busca=` | usuários sem `senhaHash` |
| POST `/usuarios` | A | `{ nome, email, senha, perfil }` com perfil `ADMIN` ou `SECRETARIA` | 201 usuário; 409 e-mail repetido |
| PUT `/usuarios/:id` | A | `{ nome?, email?, telefone?, ativo? }` | usuário |
| POST `/usuarios/:id/redefinir-senha` | A | `{ novaSenha }` | 204 |
| GET `/alunos` | A S P | `?busca=` (nome, e-mail ou RA) | `AlunoDTO[]` por nome |
| GET `/alunos/:id` | A S P | | `AlunoDTO` + `matriculas: [{ id, status, serieAtual, curso: { id, nome, nivel } }]` |
| POST `/alunos` | A S | `{ nome, email, senha, cpf?, telefone?, dataNascimento, endereco?, responsavelNome?, responsavelTelefone?, responsavelEmail? }` | 201 `AlunoDTO`; cria `Usuario` (perfil ALUNO) e `Aluno` na mesma transação; RA = ano atual + sequência de 5 dígitos (`202600001`) |
| PUT `/alunos/:id` | A S | mesmos campos, todos opcionais, sem `senha` | `AlunoDTO` |
| DELETE `/alunos/:id` | A S | | 204; apenas marca `usuario.ativo = false` |
| GET `/professores` | A S | `?busca=` | `ProfessorDTO[]` |
| GET `/professores/:id` | A S | | `ProfessorDTO` |
| POST `/professores` | A S | `{ nome, email, senha, cpf?, telefone?, titulacao, area? }` | 201; registro = `P` + 4 dígitos (`P0001`) |
| PUT `/professores/:id` | A S | campos opcionais, sem `senha` | `ProfessorDTO` |
| DELETE `/professores/:id` | A S | | 204; marca inativo |
| GET `/perfil/meu` | todos | | usuário sem `senhaHash` + `aluno` ou `professor` (ou `null`) |
| PUT `/perfil/meu` | todos | `{ telefone?, endereco? }` (`endereco` só se for aluno) | mesmo formato |

### 5.3 Estrutura acadêmica (módulo `academico`, g05)

`TurmaDTO`: `Turma` + `disciplina: { id, nome, codigo, creditos, cursoId, curso: { id, nome, nivel, regime } }`, `professor: { id, usuario: { nome } }`, `periodoLetivo: { id, nome }`, `_count: { inscricoes }`.

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/cursos` | todos | `?nivel=&ativo=` | cursos por nome |
| GET `/cursos/:id` | todos | | curso + `disciplinas` (por `periodoSugerido`, nome), cada uma com `preRequisitos: [{ id, nome, codigo }]` |
| POST `/cursos` | A S | `{ nome, codigo, nivel, regime, duracaoPeriodos, cargaHorariaTotal, mensalidade }` | 201; 409 código repetido |
| PUT `/cursos/:id` | A S | campos opcionais + `ativo?` | curso |
| DELETE `/cursos/:id` | A S | | 204; marca `ativo = false` |
| GET `/disciplinas` | todos | `?cursoId=` | disciplinas com `preRequisitos` |
| POST `/disciplinas` | A S | `{ cursoId, nome, codigo, cargaHoraria, creditos, periodoSugerido, obrigatoria, preRequisitoIds: number[] }` | 201 |
| PUT `/disciplinas/:id` | A S | campos opcionais (`preRequisitoIds` substitui a lista) | disciplina |
| DELETE `/disciplinas/:id` | A S | | 204; 409 se tiver turmas |
| GET `/periodos-letivos` | todos | `?ativo=` | por `inicio` decrescente |
| POST `/periodos-letivos` | A S | `{ nome, ano, tipo, inicio, fim }` | 201 |
| PUT `/periodos-letivos/:id` | A S | campos opcionais + `ativo?` | período |
| GET `/turmas/minhas` | P | `?periodoLetivoId=` | `TurmaDTO[]` do professor logado |
| GET `/turmas` | A S P | `?periodoLetivoId=&cursoId=&professorId=&grupo=` | `TurmaDTO[]` |
| GET `/turmas/:id` | A S P | | `TurmaDTO` |
| POST `/turmas` | A S | `{ codigo, disciplinaId, periodoLetivoId, professorId, grupo?, vagas, sala? }` | 201; 409 código repetido no período |
| PUT `/turmas/:id` | A S | campos opcionais | `TurmaDTO` |
| DELETE `/turmas/:id` | A S | | 204; 409 se tiver inscrições |

### 5.4 Matrícula (módulo `matricula`, g06)

`MatriculaDTO`: `Matricula` + `aluno: { id, ra, usuario: { nome } }`, `curso: { id, nome, nivel, regime }`, `periodoIngresso: { id, nome }`.
`InscricaoDTO`: `Inscricao` + `turma: { id, codigo, grupo, disciplina: { id, nome, codigo, creditos, cargaHoraria }, periodoLetivo: { id, nome }, professor: { usuario: { nome } } }`.

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/matriculas/minhas` | L | | `MatriculaDTO[]` do aluno logado |
| GET `/matriculas` | A S P | `?alunoId=&cursoId=&status=` | `MatriculaDTO[]` |
| GET `/matriculas/:id` | A S P, ou L dono | | `MatriculaDTO` + `inscricoes: InscricaoDTO[]` |
| POST `/matriculas` | A S | `{ alunoId, cursoId, periodoIngressoId, serieAtual? }` | 201; 409 se já matriculado no curso |
| PUT `/matriculas/:id` | A S | `{ status?, serieAtual? }` | `MatriculaDTO` |
| POST `/matriculas/:id/enturmar` | A S | `{ periodoLetivoId, grupo }` | `{ inscritas: number }`; inscreve em todas as turmas do período com esse `grupo` cujas disciplinas são do curso da matrícula, pulando as já inscritas |
| GET `/matriculas/:id/turmas-disponiveis` | A S, ou L dono | `?periodoLetivoId=` | `TurmaDTO[]` (formato 5.3) das disciplinas do curso no período, cada uma com `situacao` e `pendentes: string[]` |
| POST `/inscricoes` | A S, ou L dono | `{ matriculaId, turmaId }` | 201 `InscricaoDTO`; 409 com o motivo se `situacao` não for `DISPONIVEL` |
| DELETE `/inscricoes/:id` | A S, ou L dono | | 204; só com status `CURSANDO`: apaga se não houver notas nem presenças, senão muda para `TRANCADO` |

`situacao` (primeira que se aplicar): `JA_INSCRITO` (inscrição CURSANDO nessa disciplina no período), `JA_APROVADO` (inscrição APROVADO na disciplina em qualquer período), `PRE_REQUISITO_PENDENTE` (algum pré-requisito sem APROVADO; `pendentes` traz os nomes), `SEM_VAGA` (inscrições não trancadas >= `vagas`), senão `DISPONIVEL`. Matrícula precisa estar `ATIVA` para inscrever (senão 409).

### 5.5 Diário, notas e boletim (módulo `diario`, g07)

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/turmas/:id/diario` | A S, ou P dono da turma | | `{ turma: TurmaDTO, inscricoes: [{ id, status, notaFinal, frequencia, aluno: { ra, nome } }], avaliacoes: [{ id, nome, peso, data, notaMaxima }], notas: [{ avaliacaoId, inscricaoId, valor }], aulas: [{ id, data, conteudo, presentes, total }] }` (`presentes` e `total` são a contagem de presenças da aula; inscrições por nome, sem as `TRANCADO`) |
| POST `/turmas/:id/avaliacoes` | A, ou P dono | `{ nome, peso, data, notaMaxima? }` | 201 avaliação |
| PUT `/avaliacoes/:id` | A, ou P dono | campos opcionais | avaliação |
| DELETE `/avaliacoes/:id` | A, ou P dono | | 204 |
| PUT `/avaliacoes/:id/notas` | A, ou P dono | `{ notas: [{ inscricaoId, valor }] }` (0 <= valor <= notaMaxima) | 204; faz upsert e recalcula as inscrições |
| GET `/aulas/:id` | A S, ou P dono | | aula + `presencas: [{ inscricaoId, presente }]` |
| POST `/turmas/:id/aulas` | A, ou P dono | `{ data, conteudo?, presencas: [{ inscricaoId, presente }] }` | 201 aula; recalcula |
| PUT `/aulas/:id` | A, ou P dono | mesmo corpo | aula; recalcula |
| DELETE `/aulas/:id` | A, ou P dono | | 204; recalcula |
| POST `/turmas/:id/fechar` | A, ou P dono | | inscrições atualizadas; define `status` de cada inscrição `CURSANDO` com `calcularSituacao` |
| POST `/turmas/:id/reabrir` | A | | 204; volta para `CURSANDO` as inscrições aprovadas/reprovadas da turma |
| GET `/boletim/meu` | L | `?matriculaId=` (padrão: primeira matrícula ATIVA) | `BoletimDTO` |
| GET `/boletim/:matriculaId` | A S | | `BoletimDTO` |
| GET `/historico/meu` | L | `?matriculaId=` | `HistoricoDTO` |
| GET `/historico/:matriculaId` | A S | | `HistoricoDTO` |

Recalcular uma inscrição (sem mudar `status`): `notaFinal` = média ponderada de `valor / notaMaxima * 10` pelas avaliações que têm nota lançada (peso da avaliação), arredondada a 1 casa, ou `null` se não houver nota; `frequencia` = presenças `true` / total de presenças registradas * 100, arredondada a 1 casa, ou `null` se não houver aula.

`BoletimDTO`: `{ matricula: MatriculaDTO, periodos: [{ periodo: { id, nome }, itens: [{ inscricaoId, disciplina, codigo, turma, professor, avaliacoes: [{ nome, peso, notaMaxima, valor: number | null }], notaFinal, frequencia, status }] }] }` (períodos do mais recente para o mais antigo).

`HistoricoDTO`: `{ matricula: MatriculaDTO, itens: [{ periodo, codigo, disciplina, cargaHoraria, creditos, notaFinal, frequencia, status }], resumo: { creditosConcluidos, cargaHorariaConcluida, coeficiente } }`. `coeficiente` = média das `notaFinal` das inscrições aprovadas ou reprovadas, ponderada por `cargaHoraria`, 2 casas, ou `null`.

### 5.6 Pós-graduação (módulo `pos`, g08)

`ProjetoDTO`: `ProjetoPesquisa` + `matricula: { id, aluno: { ra, usuario: { nome } }, curso: { id, nome, nivel } }`, `orientador: { id, usuario: { nome } }`, `coorientador` (igual ou `null`), `bancas: [Banca + membros: [BancaMembro + professor: { usuario: { nome } } | null]]`.

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/pos/projetos` | todos | `?status=` | `ProjetoDTO[]`: A/S veem todos; P vê onde é orientador ou coorientador; L vê os das próprias matrículas |
| GET `/pos/projetos/:id` | mesmas regras (403 se não for dele) | | `ProjetoDTO` |
| POST `/pos/projetos` | A S | `{ matriculaId, orientadorId, coorientadorId?, titulo, resumo, linhaPesquisa? }` | 201; 409 se o curso não for de pós (`ehPos`) ou se a matrícula já tiver projeto |
| PUT `/pos/projetos/:id` | A S: tudo; L dono: só `titulo`, `resumo`, `linhaPesquisa` | `{ titulo?, resumo?, linhaPesquisa?, orientadorId?, coorientadorId?, status? }` | `ProjetoDTO` |
| POST `/pos/projetos/:id/bancas` | A S | `{ tipo, data, local?, membros: [{ professorId?, nomeExterno?, instituicao?, papel }] }` | 201 banca com membros |
| PUT `/pos/bancas/:id` | A S | `{ data?, local?, resultado?, parecer?, membros? }` (`membros` substitui a lista) | banca com membros |
| DELETE `/pos/bancas/:id` | A S | | 204 |

Regras: cada membro tem `professorId` **ou** `nomeExterno` (400 se nenhum ou os dois). Banca `DEFESA` em curso MESTRADO ou DOUTORADO só pode ser criada com o projeto `QUALIFICADO` (409). Ao gravar `resultado`: QUALIFICACAO aprovada (com ou sem ressalvas) -> projeto `QUALIFICADO`; DEFESA aprovada -> projeto `APROVADO`; DEFESA `REPROVADO` -> projeto `REPROVADO`.

### 5.7 Financeiro (módulo `financeiro`, g09)

`MensalidadeDTO`: `Mensalidade` + `valorFinal` (`valor - desconto`) + `matricula: { id, aluno: { ra, usuario: { nome } }, curso: { nome } }`.

Antes de qualquer listagem, o módulo marca como `ATRASADA` toda mensalidade `ABERTA` com `vencimento` anterior a hoje.

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/mensalidades/minhas` | L | | `MensalidadeDTO[]` por vencimento |
| GET `/mensalidades` | A S | `?matriculaId=&status=&competencia=` | `MensalidadeDTO[]` |
| POST `/mensalidades/gerar` | A S | `{ matriculaId, ano, mesInicial, mesFinal, diaVencimento }` | `{ criadas: number }`; uma por mês, `valor` = `curso.mensalidade`, `desconto` = valor * percentual da bolsa ativa de maior percentual / 100; pula competências existentes |
| POST `/mensalidades/:id/pagar` | A S | `{ formaPagamento }` | `MensalidadeDTO`; 409 se já paga ou cancelada |
| POST `/mensalidades/:id/cancelar` | A S | | `MensalidadeDTO`; 409 se paga |
| GET `/bolsas` | A S | `?matriculaId=` | bolsas + `matricula` (formato acima) |
| POST `/bolsas` | A S | `{ matriculaId, nome, percentual, inicio, fim? }` | 201 |
| PUT `/bolsas/:id` | A S | campos opcionais + `ativa?` | bolsa |
| DELETE `/bolsas/:id` | A S | | 204 |
| GET `/financeiro/resumo` | A S | | `{ aberto, pago, atrasado, quantidadeBolsas }` (somas de `valorFinal` por status) |

É só controle interno: não existe cobrança, boleto nem integração de pagamento.

### 5.8 Biblioteca (módulo `biblioteca`, g09)

`EmprestimoDTO`: `Emprestimo` + `livro: { id, titulo, autor }`, `usuario: { id, nome, perfil }`, `atrasado: boolean` (ATIVO e `devolucaoPrevista` anterior a agora).

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/livros` | todos | `?busca=` (título, autor ou categoria) | livros por título |
| POST `/livros` | A S | `{ titulo, autor, isbn?, editora?, ano?, categoria?, exemplares }` | 201 (`disponiveis` = `exemplares`) |
| PUT `/livros/:id` | A S | campos opcionais | livro; ao mudar `exemplares`, ajusta `disponiveis` pela diferença (nunca negativo) |
| DELETE `/livros/:id` | A S | | 204; 409 se tiver empréstimo ATIVO |
| GET `/emprestimos/meus` | todos | | `EmprestimoDTO[]` do usuário logado |
| GET `/emprestimos` | A S | `?status=&usuarioId=` | `EmprestimoDTO[]` |
| POST `/emprestimos` | A S | `{ livroId, usuarioId, dias? }` (padrão 14) | 201; 409 se `disponiveis` = 0; decrementa `disponiveis` na mesma transação |
| POST `/emprestimos/:id/devolver` | A S | | `EmprestimoDTO`; 409 se já devolvido; incrementa `disponiveis` |

### 5.9 Horários e calendário (módulo `agenda`, g10)

`HorarioDTO`: `HorarioAula` + `turma: { id, codigo, grupo, sala, disciplina: { nome }, professor: { usuario: { nome } }, periodoLetivo: { id, nome } }`.

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/horarios/meus` | P L | | `HorarioDTO[]`: P = turmas dele em períodos ativos; L = turmas com inscrição `CURSANDO` |
| GET `/horarios` | A S | `?turmaId=&periodoLetivoId=&grupo=` | `HorarioDTO[]` por dia e hora |
| POST `/horarios` | A S | `{ turmaId, diaSemana, horaInicio, horaFim, sala? }` | 201; 400 se `horaFim` <= `horaInicio`; 409 se houver choque no mesmo período letivo e dia, com intervalo sobreposto, para o mesmo professor ou a mesma sala |
| DELETE `/horarios/:id` | A S | | 204 |
| GET `/calendario` | todos | `?de=&ate=` | eventos por `inicio` |
| POST `/calendario` | A S | `{ titulo, descricao?, inicio, fim, tipo, periodoLetivoId? }` | 201 |
| PUT `/calendario/:id` | A S | campos opcionais | evento |
| DELETE `/calendario/:id` | A S | | 204 |

### 5.10 Comunicados (módulo `comunicados`, g10)

`ComunicadoDTO`: `Comunicado` + `autor: { nome }`, `turma: { codigo } | null`, `curso: { nome } | null`, `lido: boolean` (para o usuário logado).

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/comunicados` | todos | | `ComunicadoDTO[]` do mais novo ao mais antigo, só os visíveis ao usuário |
| POST `/comunicados` | A S: qualquer público; P: só `TURMA` de turma dele | `{ titulo, corpo, publico, turmaId?, cursoId? }` | 201; `turmaId` obrigatório se `TURMA`, `cursoId` se `CURSO` |
| DELETE `/comunicados/:id` | A, ou o autor | | 204 |
| POST `/comunicados/:id/ler` | todos | | 204; cria a leitura se não existir |

Visibilidade: A e S veem todos. O autor vê os seus. `TODOS` todos veem. `ALUNOS` só L. `PROFESSORES` só P. `TURMA`: L com inscrição não trancada na turma, e o P da turma. `CURSO`: L com matrícula no curso, e P com turma de disciplina do curso.

## 6. Código compartilhado do cliente (feito pelo g02)

```ts
// src/lib/tipos.ts
export type Perfil = 'ADMIN' | 'SECRETARIA' | 'PROFESSOR' | 'ALUNO';
export interface UsuarioLogado { id: number; nome: string; email: string; perfil: Perfil; alunoId: number | null; professorId: number | null }
export const NIVEIS: { valor: string; rotulo: string }[]; // os 8 níveis com rótulo em português
export function rotuloNivel(nivel: string): string;

// src/lib/api.ts  (prefixa '/api', manda o token, lança Error com a mensagem de `erro`; em 401 faz logout)
export const api: {
  get<T>(caminho: string): Promise<T>;
  post<T>(caminho: string, corpo?: unknown): Promise<T>;
  put<T>(caminho: string, corpo?: unknown): Promise<T>;
  del(caminho: string): Promise<void>;
};

// src/lib/auth.tsx
export function useAuth(): { usuario: UsuarioLogado | null; entrar(email: string, senha: string): Promise<void>; sair(): void };

// src/lib/rotas.ts
export interface RotaModulo {
  caminho: string;        // ex.: '/admin/alunos' ou '/professor/diario/:turmaId'
  rotulo: string;         // texto do menu
  icone: string;          // um emoji
  perfis: Perfil[];
  elemento: React.ReactNode;
  menu?: boolean;         // padrão true; false para telas de detalhe
  ordem?: number;         // posição no menu (menor primeiro); padrão 100
}

// src/lib/useDados.ts
export function useDados<T>(caminho: string | null): { dados: T | null; carregando: boolean; erro: string | null; recarregar(): void };
// refaz a busca quando `caminho` muda; `null` não busca
```

Componentes de `src/ui/index.tsx` (todos responsivos; estilos em `src/ui/estilo.css`):

```tsx
<Pagina titulo="Alunos" acoes={<Botao>Novo</Botao>}>...</Pagina>
<Cartao titulo?="...">...</Cartao>
<Botao variante?="primario" | "secundario" | "perigo" | "texto" tipo?="button" | "submit" desabilitado? aoClicar?>...</Botao>
<Tabela colunas={[{ titulo: 'Nome', celula: (item) => item.nome }]} dados={lista} chave={(item) => item.id} vazio?="Nada aqui" aoClicarLinha?={(item) => ...} />
   // no celular cada linha vira um cartão com "título: valor"
<Campo rotulo="Nome" valor={v} aoMudar={setV} tipo?="text" | "email" | "password" | "number" | "date" | "time" | "datetime-local" obrigatorio? />
<AreaTexto rotulo valor aoMudar linhas? />
<Selecao rotulo valor aoMudar opcoes={[{ valor: '1', rotulo: 'Um' }]} vazio?="Selecione" obrigatorio? />
<Caixa rotulo marcado aoMudar />              // checkbox
<Modal aberto titulo aoFechar>...</Modal>      // tela cheia no celular
<Selo cor?="verde" | "amarelo" | "vermelho" | "azul" | "cinza">ATIVA</Selo>
<Aviso tipo?="erro" | "sucesso" | "info">mensagem</Aviso>
<Carregando />
<Abas abas={[{ id: 'notas', rotulo: 'Notas' }]} ativa={id} aoMudar={setId} />
<Grade>...</Grade>                              // grade de cartões responsiva

formatarData(iso): string         // dd/mm/aaaa
formatarDataHora(iso): string
formatarMoeda(n): string          // R$ 1.234,56
paraInputData(iso): string        // aaaa-mm-dd
```

`valor` de `Campo`, `AreaTexto` e `Selecao` é sempre `string`; `aoMudar` recebe `string`.

### Como um módulo de tela se registra

Cada módulo é `client/src/modules/<modulo>/index.tsx` (pode ter outros arquivos na mesma pasta) e exporta `export const rotas: RotaModulo[]`. O `App.tsx` junta todos com `import.meta.glob('./modules/*/index.tsx', { eager: true })`, monta as rotas dentro do layout e monta o menu de cada portal com as rotas do perfil logado. As telas iniciais `/admin`, `/professor` e `/aluno` (painel com os cartões de `GET /painel`) são do g02.

Modelo de tela:

```tsx
import { useState } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import type { RotaModulo } from '../../lib/rotas';
import { Pagina, Tabela, Botao, Carregando, Aviso } from '../../ui';

function Livros() {
  const { dados, carregando, erro, recarregar } = useDados<Livro[]>('/livros');
  if (carregando) return <Carregando />;
  return <Pagina titulo="Acervo">{erro && <Aviso tipo="erro">{erro}</Aviso>}<Tabela ... /></Pagina>;
}

export const rotas: RotaModulo[] = [
  { caminho: '/aluno/biblioteca', rotulo: 'Biblioteca', icone: '📚', perfis: ['ALUNO'], elemento: <Livros />, ordem: 60 },
];
```

Regras de tela: toda ação que grava mostra erro da API em `<Aviso tipo="erro">` e recarrega a lista ao dar certo; formulários de criar/editar ficam em `<Modal>`; nada de biblioteca visual externa; tudo precisa funcionar em tela de 360 px de largura.

## 7. Menus dos portais (caminho, rótulo, ordem)

| Portal | Caminho | Rótulo | Ordem | Dono |
|---|---|---|---|---|
| admin | `/admin` | Início | 0 | g02 |
| admin | `/admin/alunos` | Alunos | 10 | g04 |
| admin | `/admin/professores` | Professores | 11 | g04 |
| admin | `/admin/usuarios` | Usuários (só ADMIN) | 12 | g04 |
| admin | `/admin/cursos` | Cursos | 20 | g05 |
| admin | `/admin/periodos` | Períodos letivos | 21 | g05 |
| admin | `/admin/turmas` | Turmas | 22 | g05 |
| admin | `/admin/matriculas` | Matrículas | 30 | g06 |
| admin | `/admin/boletins` | Boletins | 40 | g07 |
| admin | `/admin/pos` | Pós-graduação | 50 | g08 |
| admin | `/admin/financeiro` | Financeiro | 60 | g09 |
| admin | `/admin/biblioteca` | Biblioteca | 61 | g09 |
| admin | `/admin/horarios` | Horários | 70 | g10 |
| admin | `/admin/calendario` | Calendário | 71 | g10 |
| admin | `/admin/comunicados` | Comunicados | 72 | g10 |
| professor | `/professor` | Início | 0 | g02 |
| professor | `/professor/turmas` | Minhas turmas | 10 | g05 |
| professor | `/professor/diario/:turmaId` | (sem menu) | | g07 |
| professor | `/professor/orientacoes` | Orientações | 50 | g08 |
| professor | `/professor/biblioteca` | Biblioteca | 61 | g09 |
| professor | `/professor/horario` | Horário | 70 | g10 |
| professor | `/professor/calendario` | Calendário | 71 | g10 |
| professor | `/professor/comunicados` | Comunicados | 72 | g10 |
| professor | `/professor/perfil` | Meu perfil | 90 | g04 |
| aluno | `/aluno` | Início | 0 | g02 |
| aluno | `/aluno/matricula` | Matrícula | 30 | g06 |
| aluno | `/aluno/boletim` | Boletim | 40 | g07 |
| aluno | `/aluno/historico` | Histórico | 41 | g07 |
| aluno | `/aluno/pesquisa` | Pesquisa | 50 | g08 |
| aluno | `/aluno/financeiro` | Financeiro | 60 | g09 |
| aluno | `/aluno/biblioteca` | Biblioteca | 61 | g09 |
| aluno | `/aluno/horario` | Horário | 70 | g10 |
| aluno | `/aluno/calendario` | Calendário | 71 | g10 |
| aluno | `/aluno/comunicados` | Comunicados | 72 | g10 |
| aluno | `/aluno/perfil` | Meu perfil | 90 | g04 |

## 8. Verificação (todos os geradores)

- Ninguém além de g01 (server) e g02 (client) roda `npm install`. Os demais usam o `node_modules` já instalado.
- Servidor: `cd server && npx tsc --noEmit`. Cliente: `cd client && npx tsc --noEmit`.
- Outros geradores trabalham ao mesmo tempo: erros de `tsc` em arquivos de outro módulo não são seus. O seu critério é **zero erro nos seus arquivos**.
- Ninguém sobe Docker nem banco durante a geração. O teste de ponta a ponta é feito pelo main no final.
