# Mini-plano g01 (2ª tarefa): dados de demonstração

Só começa depois de a base do servidor (g01, 1ª tarefa) estar aprovada.

## Objetivo

Criar `server/prisma/seed.ts`, que popula o banco com uma escola fictícia cobrindo todos os níveis de ensino e todos os módulos, para o sistema abrir já com conteúdo.

Leia antes: `server/prisma/schema.prisma` inteiro e `docs/plano/CONTRATOS.md` (seções 1 e 5, para saber como os dados são usados).

## Arquivo que você pode criar (e só este)

- `server/prisma/seed.ts`

## Regras

1. O script é idempotente: se `prisma.usuario.count()` for maior que zero, imprime `Banco já possui dados, seed ignorado.` e termina com sucesso. O contêiner roda o seed em toda subida.
2. Termina com `prisma.$disconnect()`; em erro, imprime e sai com `process.exit(1)`.
3. Todos os dados são fictícios. Instituição: "Instituto Horizonte". E-mails no domínio `escola.demo`. Não use nomes de pessoas reais conhecidas, CPFs válidos nem telefones reais (use `(11) 90000-00NN`).
4. Senha de todos os usuários: `demo1234`, gravada com `bcrypt.hashSync('demo1234', 10)` calculado uma vez só.
5. Datas relativas ao ano de 2026.
6. Use `create` com `data` aninhado ou guarde os registros criados em variáveis; não dependa de IDs fixos.

## Dados

**Usuários administrativos**: `admin@escola.demo` (ADMIN, "Administrador Demo"), `secretaria@escola.demo` (SECRETARIA, "Secretaria Demo").

**Professores** (registro P0001 em diante):

| Nome | E-mail | Titulação | Área |
|---|---|---|---|
| Ana Ribeiro | `prof.ana@escola.demo` | DOUTOR | Computação |
| Bruno Tavares | `prof.bruno@escola.demo` | MESTRE | Matemática |
| Carla Mendes | `prof.carla@escola.demo` | ESPECIALISTA | Língua Portuguesa |
| Diego Farias | `prof.diego@escola.demo` | DOUTOR | Ciências |

**Períodos letivos**: `2025` (ANUAL, 03/02/2025 a 12/12/2025, `ativo: false`), `2026` (ANUAL, 02/02/2026 a 11/12/2026, ativo), `2026.1` (SEMESTRAL, 02/02/2026 a 30/06/2026, `ativo: false`), `2026.2` (SEMESTRAL, 03/08/2026 a 11/12/2026, ativo).

**Cursos**, um por nível:

| Código | Nome | Nível | Regime | Duração | Carga horária | Mensalidade |
|---|---|---|---|---|---|---|
| EF1 | Ensino Fundamental I | FUNDAMENTAL_1 | SERIADO | 5 | 4000 | 850 |
| EF2 | Ensino Fundamental II | FUNDAMENTAL_2 | SERIADO | 4 | 3200 | 950 |
| EM | Ensino Médio | MEDIO | SERIADO | 3 | 3000 | 1100 |
| TINF | Técnico em Informática | TECNICO | SERIADO | 2 | 1200 | 600 |
| BCC | Bacharelado em Ciência da Computação | GRADUACAO | CREDITOS | 8 | 3200 | 1400 |
| ESPDS | Especialização em Ciência de Dados | ESPECIALIZACAO | CREDITOS | 3 | 360 | 900 |
| MCC | Mestrado em Computação | MESTRADO | CREDITOS | 4 | 720 | 0 |
| DCC | Doutorado em Computação | DOUTORADO | CREDITOS | 8 | 1440 | 0 |

**Disciplinas** (código único; `creditos` = carga horária / 15 nos cursos de créditos, 0 nos seriados):

- EF1, série 3: Língua Portuguesa, Matemática, Ciências, História e Geografia (160 h cada).
- EF2, série 6 (`periodoSugerido: 1`): Língua Portuguesa, Matemática, Ciências, História, Geografia, Inglês (120 h cada).
- EM, série 1: Língua Portuguesa, Matemática, Física, Química, Biologia, História (120 h cada).
- TINF, série 1: Lógica de Programação, Redes de Computadores, Banco de Dados (120 h cada).
- BCC: semestre 1: Algoritmos I (60 h), Cálculo I (60 h), Introdução à Computação (30 h). Semestre 2: Algoritmos II (60 h, pré-requisito Algoritmos I), Cálculo II (60 h, pré-requisito Cálculo I), Estruturas de Dados (60 h, pré-requisito Algoritmos I). Semestre 3: Banco de Dados I (60 h, pré-requisito Estruturas de Dados).
- ESPDS: Estatística para Dados (45 h), Aprendizado de Máquina (60 h), Visualização de Dados (45 h).
- MCC: Metodologia de Pesquisa (60 h), Tópicos em Inteligência Artificial (60 h), Seminários de Mestrado (30 h).
- DCC: Seminários Avançados (60 h), Tópicos Especiais em Sistemas Distribuídos (60 h), Estágio de Docência (30 h).

**Turmas** (código = código da disciplina + `-` + grupo ou `A`):

- Período `2026`, cursos seriados: uma turma por disciplina, grupos `3A` (EF1), `6A` (EF2), `1A` (EM), `T1` (TINF). Distribua os professores por área (Carla em Língua Portuguesa, História, Geografia e Inglês; Bruno em Matemática, Física e Cálculo; Diego em Ciências, Química e Biologia; Ana nas de informática).
- Período `2026.1` (encerrado), BCC: Algoritmos I, Cálculo I, Introdução à Computação.
- Período `2026.2`, BCC: Algoritmos II, Cálculo II, Estruturas de Dados, e também Algoritmos I e Cálculo I. ESPDS, MCC e DCC: uma turma para cada disciplina (professores Ana, Bruno e Diego).

**Alunos** (RA `202600001` em diante; preencha data de nascimento coerente com o nível, endereço fictício e, nos menores de idade, os dados do responsável):

| Nome | E-mail | Curso | Observação |
|---|---|---|---|
| Lucas Pereira | `aluno.lucas@escola.demo` | EF2 | série 1, grupo 6A |
| Sofia Almeida | `aluna.sofia@escola.demo` | EF1 | série 3, grupo 3A |
| Pedro Nogueira | `aluno.pedro@escola.demo` | EF2 | série 1, grupo 6A |
| Helena Castro | `aluna.helena@escola.demo` | EM | série 1, grupo 1A |
| Tiago Barros | `aluno.tiago@escola.demo` | TINF | série 1, grupo T1 |
| Marina Costa | `aluna.marina@escola.demo` | BCC | ingresso 2026.1 |
| João Vieira | `aluno.joao@escola.demo` | BCC | ingresso 2026.1 |
| Beatriz Lima | `aluna.beatriz@escola.demo` | ESPDS | ingresso 2026.2 |
| Camila Duarte | `aluna.camila@escola.demo` | MCC | ingresso 2026.2 |
| Rafael Monteiro | `aluno.rafael@escola.demo` | DCC | ingresso 2026.2 |

**Matrículas e inscrições**:

- Alunos de cursos seriados: matrícula com ingresso em `2026` e inscrição `CURSANDO` em todas as turmas do grupo deles.
- Marina (BCC): em `2026.1`, `APROVADO` em Algoritmos I (nota 8,5, frequência 92), Cálculo I (7,0, 85) e Introdução à Computação (9,0, 100). Em `2026.2`, `CURSANDO` em Algoritmos II, Cálculo II e Estruturas de Dados.
- João (BCC): em `2026.1`, `APROVADO` em Algoritmos I (6,5, 80) e Introdução à Computação (7,5, 90), `REPROVADO_NOTA` em Cálculo I (4,0, 78). Em `2026.2`, `CURSANDO` em Algoritmos II e em Cálculo I de novo.
- Beatriz, Camila e Rafael: `CURSANDO` em todas as turmas `2026.2` dos respectivos cursos.

**Avaliações, notas e aulas** (para o diário e o boletim terem conteúdo):

- Em todas as turmas de `2026` do grupo `6A` e em Algoritmos II de `2026.2`: duas avaliações ("Prova 1", peso 4, e "Trabalho", peso 2), com notas entre 5 e 10 para cada inscrito; uma terceira avaliação "Prova 2" (peso 4) sem notas; quatro aulas com datas em semanas seguidas e conteúdo curto, com presenças (a maioria presente, uma ou duas faltas espalhadas).
- Depois de criar notas e presenças, grave `notaFinal` e `frequencia` nessas inscrições seguindo a regra da seção 5.5 do contrato (média ponderada das avaliações com nota, escala 0 a 10, 1 casa; percentual de presença, 1 casa). Mantenha `status: 'CURSANDO'`.

**Horários**: para as turmas do grupo `6A` e para as turmas `2026.2` do BCC, um ou dois horários por semana, sem choque de professor nem de sala (salas "Sala 101", "Sala 102", "Lab 1"...; manhã para o `6A`, noite para o BCC).

**Calendário** (2026): "Início do ano letivo" (LETIVO, 02/02), "Carnaval" (FERIADO, 16/02 a 17/02), "Recesso de julho" (RECESSO, 13/07 a 31/07), "Semana de provas do 2º semestre" (PROVA, 23/11 a 27/11), "Feira de Ciências" (EVENTO, 17/10), "Dia do Professor" (FERIADO, 15/10), "Encerramento do ano letivo" (LETIVO, 11/12).

**Pós-graduação**:

- Camila (MCC): projeto "Detecção de anomalias em redes com aprendizado profundo", orientadora Ana, status `EM_ELABORACAO`, uma banca de `QUALIFICACAO` agendada para 10/12/2026 (resultado `PENDENTE`; Ana presidente, Diego membro interno, um membro externo fictício "Dra. Elisa Prado" da "Universidade Exemplo").
- Rafael (DCC): projeto "Consenso tolerante a falhas em sistemas distribuídos de larga escala", orientadora Ana, coorientador Diego, status `QUALIFICADO`, banca de `QUALIFICACAO` em 20/10/2026 com resultado `APROVADO_COM_RESSALVAS` e parecer curto.
- Beatriz (ESPDS): projeto "Painel de indicadores educacionais com dados abertos", orientador Bruno, `EM_ELABORACAO`, sem banca.

**Financeiro**:

- Bolsa "Bolsa Mérito" de 50% para Marina (início 01/08/2026, ativa).
- Mensalidades de agosto a dezembro de 2026 (competências `2026-08` a `2026-12`, vencimento dia 10) para Lucas, Helena, Tiago, Marina, João e Beatriz, com `valor` = mensalidade do curso e `desconto` de 50% para Marina. Agosto a outubro `PAGA` (com `pagoEm` no dia 8 do mês e `formaPagamento: 'Pix'`), exceto João, que fica com outubro `ABERTA`. Novembro e dezembro `ABERTA`.

**Biblioteca**: 10 livros fictícios ou em domínio público (ex.: "Dom Casmurro" de Machado de Assis, "O Cortiço" de Aluísio Azevedo, e títulos didáticos genéricos como "Fundamentos de Algoritmos", "Cálculo: Volume 1", "Introdução a Banco de Dados", com autor fictício), com 1 a 4 exemplares. Três empréstimos: Marina com "Fundamentos de Algoritmos" (ativo, devolução prevista para 14 dias depois de hoje), Lucas com "Dom Casmurro" (ativo, devolução prevista de 5 dias atrás, para aparecer atrasado), professor Bruno com "Cálculo: Volume 1" (devolvido). Ajuste `disponiveis` de acordo com os empréstimos ativos.

**Comunicados**: "Boas-vindas ao segundo semestre" (TODOS, autor secretaria), "Reunião de pais do 6º ano" (TURMA, turma de Matemática do 6A, autor secretaria), "Entrega do Trabalho de Algoritmos II" (TURMA, turma de Algoritmos II, autora Ana), "Conselho de classe" (PROFESSORES, autor admin), "Inscrições para a Semana da Computação" (CURSO, BCC, autor secretaria).

## Critérios de aceite

- `cd server && npx tsc --noEmit` sem erro em `prisma/seed.ts`.
- Todos os e-mails citados no README (g03) existem no seed: `admin@escola.demo`, `secretaria@escola.demo`, `prof.ana@escola.demo`, `aluno.lucas@escola.demo`, `aluna.marina@escola.demo`, `aluno.rafael@escola.demo`.
- Nenhum horário do seed tem choque de professor ou de sala.
- Rodar o seed duas vezes não duplica nada.

## Verificação

```
cd server
npx tsc --noEmit
```

Não suba banco nem Docker; o main roda o seed no teste de integração.
