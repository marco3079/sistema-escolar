# Mini-plano g05: API das fichas do aluno e do professor

## Objetivo

Criar dois endpoints que juntam, numa resposta só, tudo o que o sistema sabe sobre um aluno ou sobre um professor, para a tela de ficha (um mini painel que abre ao clicar na pessoa).

Leia antes: `server/prisma/schema.prisma` inteiro, `docs/plano/CONTRATOS.md` seções 3 e 4, os arquivos reais de `server/src/lib/`, e como exemplos de módulo `server/src/modules/painel/routes.ts` e `server/src/modules/cadastros/routes.ts`.

## Arquivo que você pode criar (e só este)

- `server/src/modules/fichas/routes.ts`

Não edite `server/src/modules/cadastros/routes.ts` nem nenhum outro arquivo. (Os caminhos `/alunos/:id/ficha` e `/professores/:id/ficha` não colidem com `/alunos/:id` e `/professores/:id`, que continuam no módulo `cadastros`.)

## Contrato

### `GET /api/alunos/:id/ficha` (ADMIN, SECRETARIA, PROFESSOR)

`:id` é o id do **Aluno**. 404 se não existir.

```ts
{
  aluno: {
    id: number; ra: string; nome: string; email: string; cpf: string | null; telefone: string | null;
    ativo: boolean; dataNascimento: string; idade: number; endereco: string | null;
    responsavelNome: string | null; responsavelTelefone: string | null; responsavelEmail: string | null;
    usuarioId: number; criadoEm: string;
  };
  indicadores: {
    disciplinasCursando: number;
    mediaGeral: number | null;        // média de notaFinal não nula de todas as inscrições, 1 casa
    frequenciaMedia: number | null;   // média de frequencia não nula, 1 casa
    mensalidadesEmAberto: number;     // ABERTA + ATRASADA
    valorEmAberto: number;            // soma de (valor - desconto) dessas mensalidades, 2 casas
    emprestimosAtivos: number;
  };
  matriculas: {
    id: number; status: string; serieAtual: number; dataMatricula: string;
    curso: { id: number; nome: string; nivel: string; regime: string };
    periodoIngresso: string;          // nome do período
  }[];
  disciplinas: {                      // todas as inscrições, da mais recente para a mais antiga (por início do período)
    inscricaoId: number; disciplina: string; codigo: string; turma: string; periodo: string;
    professor: string; status: string; notaFinal: number | null; frequencia: number | null;
  }[];
  mensalidades: {                     // as 6 de vencimento mais recente
    id: number; competencia: string; vencimento: string; valorFinal: number; status: string;
  }[];
  emprestimos: {                      // os 5 mais recentes
    id: number; livro: string; retiradoEm: string; devolucaoPrevista: string;
    devolvidoEm: string | null; atrasado: boolean;
  }[];
  projeto: { id: number; titulo: string; status: string; orientador: string } | null; // primeiro projeto de pesquisa das matrículas
}
```

Regras:
- PROFESSOR só pode ver a ficha de aluno que tem inscrição (em qualquer status) em turma dele; senão 403. Para PROFESSOR, `mensalidades` vem `[]` e `indicadores.mensalidadesEmAberto` e `valorEmAberto` vêm `0`, e os campos `cpf`, `endereco`, `responsavelTelefone` e `responsavelEmail` vêm `null` (dados que não são da conta dele).
- Antes de montar `mensalidades` e os indicadores financeiros, marque como `ATRASADA` as mensalidades `ABERTA` do aluno com vencimento anterior ao início do dia de hoje (mesma regra do módulo financeiro).
- `atrasado` do empréstimo: status `ATIVO` e `devolucaoPrevista` anterior a agora.
- `idade`: anos completos na data de hoje.
- Nunca devolva `senhaHash`.

### `GET /api/professores/:id/ficha` (ADMIN, SECRETARIA)

`:id` é o id do **Professor**. 404 se não existir.

```ts
{
  professor: {
    id: number; registro: string; nome: string; email: string; cpf: string | null; telefone: string | null;
    ativo: boolean; titulacao: string; area: string | null; usuarioId: number; criadoEm: string;
  };
  indicadores: {
    turmasAtivas: number;             // turmas em períodos ativos
    alunos: number;                   // inscrições CURSANDO nessas turmas
    orientacoes: number;              // projetos como orientador ou coorientador
    frequenciaMedia: number | null;   // média de frequencia não nula das inscrições das turmas ativas, 1 casa
    mediaDasTurmas: number | null;    // média de notaFinal não nula das inscrições das turmas ativas, 1 casa
    cargaSemanalHoras: number;        // soma da duração dos horários das turmas ativas, em horas, 1 casa
  };
  turmas: {                           // todas, períodos ativos primeiro, depois por código
    id: number; codigo: string; disciplina: string; curso: string; periodo: string; periodoAtivo: boolean;
    grupo: string | null; sala: string | null; inscritos: number; vagas: number;
  }[];
  horarios: {                         // das turmas ativas, por dia e hora
    diaSemana: number; horaInicio: string; horaFim: string; sala: string | null; turma: string; disciplina: string;
  }[];
  orientacoes: {
    id: number; titulo: string; status: string; aluno: string; curso: string; papel: 'Orientador' | 'Coorientador';
  }[];
  bancas: {                           // participações como membro, da mais recente para a mais antiga
    id: number; tipo: string; data: string; resultado: string; papel: string; projeto: string;
  }[];
  emprestimos: {                      // os 5 mais recentes do usuário do professor
    id: number; livro: string; retiradoEm: string; devolucaoPrevista: string;
    devolvidoEm: string | null; atrasado: boolean;
  }[];
}
```

`cargaSemanalHoras`: para cada horário, diferença entre `horaFim` e `horaInicio` (strings "HH:MM") em horas.

## Passos

1. `const router = Router(); export default router;`, com `permitir(...)` em cada rota conforme o contrato.
2. Funções auxiliares no arquivo: `media(valores)`, `arred1`, `arred2`, `idadeEm(data)`, `horasEntre(inicio, fim)`.
3. Carregue os dados com poucas consultas (`include` e `select`), nunca consulta dentro de laço.
4. Monte as respostas exatamente no formato do contrato (nomes de campos, tipos e ordenações).
5. Rode a verificação.

## Critérios de aceite

- Os dois endpoints existem com as permissões e o formato do contrato.
- PROFESSOR recebe 403 para aluno que não é dele, e não recebe dados financeiros nem de contato restrito.
- ALUNO recebe 403 nos dois endpoints.
- `cd server && npx tsc --noEmit` com zero erro.

## Verificação

```
cd server
npx tsc --noEmit
```

Não rode `npm install`, não suba banco nem Docker, e não mexa nos contêineres do sistema.
