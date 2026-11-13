# Sexta leva: sala de aula

Segunda leva do [ROTEIRO.md](ROTEIRO.md). O usuário disse "vai" em 13/11/2026.

Itens: armazenamento de arquivos; materiais de aula; tarefas e entregas; plano de aula e conteúdo ministrado; provas online; chamada por QR code.

Padrões definidos pelo main (sem perguntar): arquivos de até 20 MB cada, até 10 por material, tarefa ou entrega; tipos aceitos: `pdf png jpg jpeg webp gif txt csv doc docx xls xlsx ppt pptx odt ods odp zip`; vídeos entram como link, não como arquivo; o código do QR muda a cada 20 segundos.

**Já feito pelo main (ninguém edita):**

- `server/prisma/schema.prisma`: modelos `Arquivo`, `MaterialAula`, `Tarefa`, `TarefaEntrega`, `PlanoAula`, `Prova`, `ProvaQuestao`, `ProvaTentativa`, `ProvaResposta`, `ChamadaQr` e o enum `TipoQuestao`. Leia-os antes de começar. Prisma Client já gerado.
- `server/src/lib/turmas.ts`: `acessoTurma(req, turmaId)`, `acessoDeEdicao`, `acessoDeAluno` e `usuariosDosAlunosDaTurma(turmaId)`. **Toda rota da sala confere o acesso por estas funções.** Papéis: `PROFESSOR` (o da turma), `GESTAO` (administrador, TI e secretaria; só o administrador e o TI têm `podeEditar`) e `ALUNO` (inscrição não trancada).
- Tipo de aviso `AULA` em `server/src/lib/notificacoes.ts` (use `notificar(usuarioIds, { tipo: 'AULA', titulo, link })`; o link é o caminho dentro do portal, sem prefixo: `/sala/{turmaId}`).
- Biblioteca `qrcode-generator` instalada no cliente.

Regras gerais (iguais às das levas anteriores): módulos do servidor em `server/src/modules/<modulo>/routes.ts` (`export default router`), com `asyncHandler`, `HttpError`, `validar`, `idParam`, `permitir` e `prisma`; erros `{ erro: string }`; validação com zod; nunca devolver e-mail, CPF, telefone ou hash de senha de outras pessoas (de aluno, só `nome` e `ra`). Cliente com `api` de `client/src/lib/api.ts`, componentes de `client/src/ui/index.tsx`, cores só por variáveis, classes com prefixo do módulo, nada estoura em 360 px, temas claro e escuro, texto vindo da API sempre como texto (nunca HTML). Verificação: `npx tsc --noEmit` no lado em que mexeu. Não rode `npm install`, `vite build` nem Docker. Em todo comando do BUS, passe o nome da sala `sistema_escolar`.

---

## Contrato A: arquivos

### `server/src/lib/arquivos.ts`

```ts
export type ContextoArquivo = 'MATERIAL' | 'TAREFA' | 'ENTREGA';
export interface ArquivoDTO { id: number; nome: string; tipo: string; tamanho: number; criadoEm: string }
export const MAX_ARQUIVOS_POR_ITEM = 10;

// Define o conjunto de arquivos de um item. Os ids que já pertencem a este mesmo item ficam; os novos
// precisam ser arquivos soltos (sem contexto) enviados por `usuarioId` (senão HttpError 400); os que
// pertenciam ao item e não vieram na lista são apagados (linha e disco). Mais de 10: HttpError 400.
export function definirArquivos(usuarioId: number, ids: number[], contexto: ContextoArquivo, contextoId: number): Promise<void>;
// Arquivos de vários itens de uma vez (sem consulta por item).
export function arquivosDe(contexto: ContextoArquivo, contextoIds: number[]): Promise<Map<number, ArquivoDTO[]>>;
// Apaga linha e disco de todos os arquivos dos itens (ao excluir material, tarefa ou entrega).
export function apagarArquivosDe(contexto: ContextoArquivo, contextoIds: number[]): Promise<void>;
```

### Rotas (`server/src/modules/arquivos/routes.ts`, qualquer usuário logado)

| Rota | O que faz |
|---|---|
| `POST /arquivos` | Corpo bruto (lido do fluxo da requisição, como o envio de cópia de segurança em `server/src/modules/backups/routes.ts`). Cabeçalhos: `Content-Type` = tipo do arquivo e `X-Nome-Arquivo` = nome com `encodeURIComponent`. Limite de 20 MB aplicado durante a leitura (`413`). A extensão precisa estar na lista aceita e combinar com o tipo (tabela fixa extensão → tipos aceitos; senão `400`). O nome é limpo (sem caminho, sem caracteres de controle, até 150 caracteres). No disco, o nome é aleatório (32 hexadecimais + extensão) em `process.env.DIRETORIO_ARQUIVOS ?? '/dados/arquivos'`, gravado como `.parcial` e renomeado no fim. No máximo 30 arquivos soltos por usuário (`400`). `201 ArquivoDTO`. |
| `GET /arquivos/:id` | Baixa. Arquivo solto: só quem enviou. Ligado: `MATERIAL` e `TAREFA` → quem tem `acessoTurma` na turma do item; `ENTREGA` → professor e gestão da turma, ou o aluno dono da entrega. Sem acesso: `404`. Resposta com o tipo gravado, `X-Content-Type-Options: nosniff` e `Content-Disposition: attachment` com o nome original (`inline` só para `image/png`, `image/jpeg`, `image/webp` e `image/gif`). |
| `DELETE /arquivos/:id` | Só arquivo solto e só quem enviou. `204`. |

- Tarefa periódica (a cada 60 minutos, com `registrarTarefaPeriodica` de `lib/agendador.ts`): apaga arquivos soltos com mais de 24 horas e arquivos `.parcial` esquecidos.
- `GET /arquivos/:id` fica fora do registro automático de atividades (acrescente à exclusão em `server/src/app.ts`).
- Infra: volume `dados_arquivos:/dados/arquivos` na `api` (`docker-compose.yml`); `client/nginx.conf` ganha `location` para `/api/arquivos` com `client_max_body_size 25m`, `proxy_request_buffering off` e os cabeçalhos de proxy; aviso na aba de cópia de segurança fica para a documentação (os arquivos enviados **não** entram na cópia do banco).

## Contrato B: salas, materiais e plano de aula (`server/src/modules/sala/routes.ts`)

```ts
type Papel = 'PROFESSOR' | 'GESTAO' | 'ALUNO';
interface SalaResumo { id: number; codigo: string; disciplina: { nome: string; codigo: string }; periodoLetivo: { id: number; nome: string }; professor: { nome: string }; papel: Papel; pendencias: { tarefas: number; provas: number } }
interface SalaDetalhe extends SalaResumo { podeEditar: boolean; alunos: number }
interface MaterialDTO { id: number; titulo: string; descricao: string; topico: string; link: string | null; criadoEm: string; autor: { nome: string }; arquivos: ArquivoDTO[] }
interface PlanoDTO { id: number; ordem: number; tema: string; objetivos: string; dataPrevista: string | null; aula: { id: number; data: string; conteudo: string | null } | null }
```

| Rota | O que faz |
|---|---|
| `GET /salas?periodoLetivoId=` | Professor: as turmas dele. Aluno: turmas com inscrição não trancada. Gestão: todas (filtro de período opcional; até 300). `pendencias` só para aluno (tarefas com prazo futuro sem entrega dele; provas publicadas, abertas agora, sem tentativa enviada); para os outros, zeros. Ordem: período mais recente, depois disciplina. `SalaResumo[]` |
| `GET /salas/:turmaId` | `SalaDetalhe` |
| `GET /salas/:turmaId/materiais` | `MaterialDTO[]`, por `topico` e depois `criadoEm` |
| `POST /salas/:turmaId/materiais` | Edição. `{ titulo (2 a 120), descricao (até 2.000), topico (até 60), link? (http ou https, até 500), arquivoIds (até 10) }`; exige link, arquivo ou descrição. `201 MaterialDTO`. Avisa os alunos: "Novo material em {disciplina}: {titulo}" |
| `PUT /materiais/:id` | Edição. Mesmo corpo. `MaterialDTO` |
| `DELETE /materiais/:id` | Edição. Apaga também os arquivos. `204` |
| `GET /salas/:turmaId/plano` | `{ itens: PlanoDTO[]; resumo: { planejadas: number; ministradas: number; aulasRegistradas: number } }` (ministrada = item com aula ligada) |
| `POST /salas/:turmaId/plano` | Edição. `{ tema (2 a 160), objetivos (até 2.000), dataPrevista? }`; entra no fim. `201 PlanoDTO` |
| `PUT /plano/:id` | Edição. `{ tema, objetivos, dataPrevista, aulaId }` (`aulaId` nulo desliga; tem de ser aula da mesma turma) |
| `PUT /salas/:turmaId/plano/ordem` | Edição. `{ ids: number[] }` com todos os itens da turma, na ordem nova. `204` |
| `DELETE /plano/:id` | Edição. `204` |
| `GET /salas/:turmaId/aulas` | Aulas do diário da turma, para ligar ao plano: `{ id, data, conteudo }[]`, da mais recente para a mais antiga (qualquer papel) |
| `GET /salas/andamento?periodoLetivoId=` | Só gestão. Por turma: `{ turmaId, codigo, disciplina, professor, planejadas, ministradas, aulas, ultimaAula: string | null }[]` |

## Contrato C: tarefas (`server/src/modules/tarefas/routes.ts`)

```ts
interface EntregaDTO { id: number; texto: string; entregueEm: string; atrasada: boolean; nota: number | null; comentario: string; corrigidaEm: string | null; arquivos: ArquivoDTO[] }
interface TarefaDTO {
  id: number; titulo: string; enunciado: string; prazo: string; notaMaxima: number; aceitaAtraso: boolean; avaliacaoId: number | null; criadaEm: string; arquivos: ArquivoDTO[];
  // só para aluno:
  situacao?: 'PENDENTE' | 'ENTREGUE' | 'CORRIGIDA' | 'ENCERRADA'; // ENCERRADA = prazo vencido, sem entrega e sem aceitar atraso
  minhaEntrega?: EntregaDTO | null;
  // só para professor e gestão:
  resumo?: { alunos: number; entregues: number; corrigidas: number };
}
```

| Rota | O que faz |
|---|---|
| `GET /salas/:turmaId/tarefas` | `TarefaDTO[]`, da mais recente para a mais antiga |
| `GET /salas/:turmaId/avaliacoes` | Edição. Avaliações do diário da turma, para ligar a nota: `{ id, nome, notaMaxima }[]` |
| `POST /salas/:turmaId/tarefas` | Edição. `{ titulo (2 a 120), enunciado (até 10.000), prazo (ISO), notaMaxima (0,1 a 100), aceitaAtraso, avaliacaoId? (da mesma turma), arquivoIds }`. `201`. Avisa os alunos: "Nova tarefa em {disciplina}: {titulo}" |
| `PUT /tarefas/:id` | Edição. Mesmo corpo. |
| `DELETE /tarefas/:id` | Edição. Apaga entregas e arquivos. `204` |
| `GET /tarefas/:id/entregas` | Professor e gestão. Todos os alunos da turma: `{ inscricaoId, aluno: { nome, ra }, entrega: EntregaDTO | null }[]`, por nome |
| `PUT /tarefas/:id/entrega` | Aluno. `{ texto (até 10.000), arquivoIds (até 10) }`; exige texto ou arquivo. Cria ou substitui a entrega enquanto não foi corrigida. Depois do prazo: só se `aceitaAtraso` (marca `atrasada`), senão `409`. Já corrigida: `409`. `EntregaDTO` |
| `PUT /entregas/:id/correcao` | Edição. `{ nota (0 a notaMaxima da tarefa), comentario (até 2.000) }`. Se a tarefa tem `avaliacaoId`, grava ou atualiza a `Nota` do diário com `nota × (notaMaxima da avaliação ÷ notaMaxima da tarefa)`, arredondada em 2 casas. Avisa o aluno: "Tarefa corrigida: {titulo}". `EntregaDTO` |

## Contrato D: provas (`server/src/modules/provas/routes.ts`)

```ts
type TipoQuestao = 'OBJETIVA' | 'VERDADEIRO_FALSO' | 'DISSERTATIVA';
interface QuestaoEdicao { id?: number; tipo: TipoQuestao; enunciado: string; alternativas: string[]; correta: number | null; pontos: number }
interface QuestaoAluno { id: number; ordem: number; tipo: TipoQuestao; enunciado: string; alternativas: string[]; pontos: number } // nunca traz `correta`
interface ProvaDTO {
  id: number; titulo: string; instrucoes: string; abreEm: string; fechaEm: string; duracaoMin: number; embaralhar: boolean; notaMaxima: number; mostrarGabarito: boolean; publicada: boolean; avaliacaoId: number | null; totalQuestoes: number; totalPontos: number;
  // só para aluno:
  estado?: 'AGENDADA' | 'ABERTA' | 'EM_ANDAMENTO' | 'ENVIADA' | 'ENCERRADA'; // ENCERRADA = fechou sem tentativa
  minhaNota?: number | null; // só depois de corrigida
  // só para professor e gestão:
  questoes?: QuestaoEdicao[];
  resumo?: { alunos: number; enviadas: number; corrigidas: number; temTentativa: boolean };
}
```

| Rota | O que faz |
|---|---|
| `GET /salas/:turmaId/provas` | `ProvaDTO[]`. O aluno só vê as publicadas |
| `POST /salas/:turmaId/provas` | Edição. `{ titulo (2 a 120), instrucoes (até 5.000), abreEm, fechaEm (depois de abreEm), duracaoMin (5 a 300), embaralhar, notaMaxima (0,1 a 100), mostrarGabarito, avaliacaoId? }`. Nasce não publicada. `201` |
| `PUT /provas/:id` | Edição. Mesmo corpo. Com tentativa iniciada, só `titulo`, `instrucoes`, `fechaEm` (para depois) e `mostrarGabarito` podem mudar (`409` nos outros) |
| `PUT /provas/:id/questoes` | Edição. `{ questoes: QuestaoEdicao[] }` (1 a 60) substitui todas. `OBJETIVA`: 2 a 6 alternativas (1 a 500 caracteres) e `correta` dentro da lista; `VERDADEIRO_FALSO`: `correta` 0 ou 1 e sem alternativas; `DISSERTATIVA`: `correta` nulo; `enunciado` 1 a 5.000; `pontos` 0,1 a 100. Com tentativa iniciada: `409` |
| `POST /provas/:id/publicar` | Edição. `{ publicada: boolean }`. Publicar exige ao menos uma questão; despublicar com tentativa iniciada: `409`. Ao publicar, avisa os alunos: "Prova disponível em {disciplina}: {titulo}" |
| `DELETE /provas/:id` | Edição. `204` |
| `POST /provas/:id/iniciar` | Aluno. Exige prova publicada e dentro de `abreEm`–`fechaEm`. Cria a tentativa (`expiraEm` = o menor entre agora + duração e `fechaEm`) ou devolve a que já existe e não foi enviada. `{ tentativa: { id, iniciadaEm, expiraEm, enviadaEm }, agora: string, questoes: QuestaoAluno[], respostas: { questaoId, alternativa: number | null, texto: string }[] }`. Com `embaralhar`, a ordem das questões é embaralhada de forma estável por tentativa (mesma ordem a cada chamada). Já enviada: `409` |
| `PUT /provas/:id/respostas` | Aluno. `{ respostas: { questaoId, alternativa?: number | null, texto?: string }[] }` grava (salvamento automático) enquanto a tentativa não foi enviada nem expirou (tolerância de 15 s). `204`; expirada ou enviada: `409` |
| `POST /provas/:id/enviar` | Aluno. Finaliza: corrige objetivas e verdadeiro ou falso; sem dissertativas, já fica corrigida com `notaFinal` = (pontos ÷ total) × `notaMaxima`, 2 casas. Aceita até 15 s depois de `expiraEm` gravando as respostas do corpo (mesmo formato de `respostas`, opcional); depois disso finaliza com o que estava salvo. `{ enviadaEm, corrigida, notaFinal }` |
| `GET /provas/:id/minha` | Aluno. `{ tentativa: {...} | null, corrigida, notaFinal, gabarito: null | { questaoId, enunciado, tipo, alternativas, correta, minhaAlternativa, meuTexto, pontos, pontosObtidos, comentario }[] }`; `gabarito` só com tentativa enviada, `mostrarGabarito` ligado e prova já fechada |
| `GET /provas/:id/tentativas` | Professor e gestão. Todos os alunos: `{ inscricaoId, aluno: { nome, ra }, tentativa: null | { id, iniciadaEm, enviadaEm, corrigida, notaObjetiva, notaFinal, pendentes: number } }[]` |
| `GET /tentativas/:id` | Professor e gestão. Detalhe com cada questão, a resposta, os pontos e o comentário |
| `PUT /tentativas/:id/correcao` | Edição. `{ respostas: { questaoId, pontos (0 a pontos da questão), comentario (até 1.000) }[] }` para as dissertativas. Quando todas têm pontos: `corrigida`, `notaFinal`, e avisa o aluno: "Prova corrigida: {titulo}" |

- Tentativas expiradas e não enviadas são finalizadas sozinhas por uma tarefa periódica (a cada 5 minutos) e também na hora em que alguém consulta a prova.
- Quando a tentativa fica corrigida e a prova tem `avaliacaoId`, grava ou atualiza a `Nota` do diário com `notaFinal × (notaMaxima da avaliação ÷ notaMaxima da prova)`.
- As rotas `PUT /provas/:id/respostas` ficam fora do registro automático de atividades (salvamento automático).

## Contrato E: chamada por QR code (`server/src/modules/chamada/routes.ts`)

Código rotativo: 6 dígitos tirados de `HMAC-SHA256(segredo, janela)`, com `janela = floor(agora / 20 s)`. Vale a janela atual e a anterior. O `segredo` (32 bytes aleatórios em hexadecimal) nunca sai pela API. Texto do QR e do código digitado: `"{chamadaId}-{codigo}"`.

| Rota | O que faz |
|---|---|
| `POST /aulas/:aulaId/chamada-qr` | Edição da turma da aula. `{ minutos (1 a 60; padrão 10) }`. Abre (ou reabre, com segredo novo) a chamada da aula. `ChamadaEstado` |
| `GET /aulas/:aulaId/chamada-qr` | Edição. `ChamadaEstado = { aberta: boolean; fechaEm: string | null; token: string | null; trocaEmSeg: number; presentes: number; total: number; lista: { inscricaoId, nome, ra, presente: boolean | null }[] }` (`token` só com a chamada aberta; `presente` nulo = sem registro) |
| `POST /aulas/:aulaId/chamada-qr/fechar` | Edição. `{ marcarFaltas?: boolean }`: com `true`, quem ficou sem registro recebe falta. `204` |
| `POST /presenca-qr` | Aluno. `{ token }`. Confere formato, chamada aberta e não vencida (`409` "A chamada foi encerrada"), código da janela atual ou anterior (`400` "Código inválido ou vencido. Leia o código de novo."), inscrição não trancada na turma da aula (`403`). Marca presença (`upsert` em `Presenca`). `{ ok: true, disciplina: string, data: string }`. Limite: 10 tentativas por minuto por usuário (`429`) |

- `GET /aulas/:aulaId/chamada-qr` (consultado a cada 2 s pela tela do professor) fica fora do registro automático de atividades.
- A frequência da inscrição continua sendo calculada no fechamento do diário; a chamada só grava as presenças.

## Contrato F: base do cliente

- `client/src/lib/arquivos.ts`:

```ts
export interface ArquivoDTO { id: number; nome: string; tipo: string; tamanho: number; criadoEm: string }
export const TAMANHO_MAXIMO_ARQUIVO = 20 * 1024 * 1024;
export const EXTENSOES_ACEITAS: string[];               // as do plano
export function tamanhoLegivel(bytes: number): string;   // "1,2 MB"
export function enviarArquivo(arquivo: File, aoProgresso?: (fracao: number) => void): Promise<ArquivoDTO>; // XMLHttpRequest, para ter progresso; token e 401 como em api.ts
export function baixarArquivo(arquivo: ArquivoDTO): Promise<void>;                                         // api.baixar(`/arquivos/${id}`, nome)
export function removerArquivoSolto(id: number): Promise<void>;
```

- `client/src/ui/Arquivos.tsx` (com `client/src/ui/arquivos.css`):
  - `CampoArquivos({ valor, aoMudar, maximo = 10, desabilitado })`: botão "Anexar arquivos" e área de arrastar e soltar; confere extensão e tamanho antes de enviar; barra de progresso por arquivo; lista com nome, tamanho e botão de remover (remove da lista; se o arquivo foi enviado agora e ainda está solto, chama `removerArquivoSolto`); mostra erro por arquivo sem perder os outros.
  - `ListaArquivos({ arquivos })`: lista compacta (ícone por tipo, nome, tamanho) em que clicar baixa.
- `client/src/ui/QrCode.tsx`: `QrCode({ texto, tamanho = 280 })` desenha o QR em SVG com `qrcode-generator` (correção de erro M), fundo branco e módulos pretos fixos (precisa de contraste para a câmera, nos dois temas), com `role="img"` e `aria-label`.
- Ícones novos em `client/src/ui/icones.tsx`: `sala`, `pasta`, `tarefa`, `prova`, `qr`, `link`, `arquivo`, `plano`. `client/src/layout/grupos.ts`: `sala` entra no grupo "Ensino" (primeiro do grupo).
- `client/src/modules/sala/comum.ts`: `export type Papel = 'PROFESSOR' | 'GESTAO' | 'ALUNO'; export interface PropsAba { turmaId: number; papel: Papel; podeEditar: boolean; base: string }` (`base` = `/admin`, `/professor` ou `/aluno`) e os tipos `SalaResumo` e `SalaDetalhe` do Contrato B.

---

## Partes

| Parte | Gerador | Arquivos (só estes) |
|---|---|---|
| R1: arquivos no servidor e infra | g08 | `server/src/lib/arquivos.ts`, `server/src/modules/arquivos/routes.ts` (novos), `server/src/app.ts` (só exclusões do log: arquivos, chamada e respostas de prova), `docker-compose.yml`, `client/nginx.conf`, `.env.example` |
| R2: salas, materiais e plano | g15 | `server/src/modules/sala/routes.ts` (novo) |
| R3: tarefas | g16 | `server/src/modules/tarefas/routes.ts` (novo) |
| R4: provas | g17 | `server/src/modules/provas/*` (novo) |
| R5: chamada por QR | g05 | `server/src/modules/chamada/routes.ts` (novo) |
| R6: base do cliente | g18 | `client/src/lib/arquivos.ts`, `client/src/ui/Arquivos.tsx`, `client/src/ui/arquivos.css`, `client/src/ui/QrCode.tsx` (novos), `client/src/ui/icones.tsx`, `client/src/layout/grupos.ts`, `client/src/modules/sala/comum.ts` (novo) |
| R7: sala, materiais e plano (telas) | g19 | `client/src/modules/sala/index.tsx`, `Salas.tsx`, `Sala.tsx`, `Materiais.tsx`, `Plano.tsx`, `Andamento.tsx`, `sala.css` (novos) |
| R8: tarefas (telas) | g20 | `client/src/modules/sala/Tarefas.tsx`, `tarefas.css` e arquivos auxiliares com prefixo `Tarefa` (novos) |
| R9: provas (telas) | g21 | `client/src/modules/sala/Provas.tsx`, `provas.css` e arquivos auxiliares com prefixo `Prova` (novos) |
| R10: chamada (telas) | g06 | `client/src/modules/sala/Chamada.tsx`, `MarcarPresenca.tsx`, `chamada.css` (novos); e um link "Sala de aula" na lista de turmas do professor em `client/src/modules/academico/turmas.tsx` ou onde essa lista estiver (só o link) |

Depois de aprovadas: dados de demonstração e documentação.

### R1 (g08)

Contrato A inteiro e a infra. Use o envio de cópia de segurança (`server/src/modules/backups/routes.ts`) como modelo de leitura do corpo bruto com limite. Publique uma nota na sala assim que `lib/arquivos.ts` estiver gravado (R2 e R3 dependem das três funções). Exclusões do log em `app.ts`: `GET /api/arquivos/:id`, `GET /api/aulas/:id/chamada-qr` e `PUT /api/provas/:id/respostas`.

### R2 (g15)

Contrato B inteiro. Sem consulta por item nas listas (use `arquivosDe` para os anexos e contagens agrupadas para as pendências e o andamento).

### R3 (g16)

Contrato C inteiro. A gravação da nota no diário usa os modelos `Avaliacao` e `Nota` (veja `server/src/modules/diario/routes.ts` só para entender; não edite).

### R4 (g17)

Contrato D inteiro. Pode dividir em arquivos dentro de `server/src/modules/provas/`. Atenção máxima: nenhuma rota de aluno devolve `correta` antes da hora; o servidor é quem decide o tempo (nunca confie em horário enviado pelo cliente); a correção automática roda dentro de transação; embaralhamento estável (por exemplo, ordenando por um hash de `tentativaId` + `questaoId`).

### R5 (g05)

Contrato E inteiro. Comparação do código em tempo constante. O limite de tentativas em memória, com limpeza periódica.

### R6 (g18)

Contrato F inteiro. ORDEM: primeiro `modules/sala/comum.ts`, `lib/arquivos.ts` e os ícones; publique uma nota na sala; depois os componentes.

### R7 (g19)

Módulo `sala`:

1. `index.tsx`: rotas `/aluno/sala`, `/professor/sala` e `/admin/sala` (rótulo "Sala de aula", ícone `sala`, no menu, ordem 39; perfis conforme o portal; no administrativo, ADMIN e SECRETARIA), `/{portal}/sala/:turmaId` (fora do menu), `/admin/andamento` (rótulo "Andamento das aulas", ícone `plano`, ADMIN e SECRETARIA, ordem 42) e `/aluno/presenca` (fora do menu; componente `MarcarPresenca` de `./MarcarPresenca`, do g06).
2. `Salas.tsx`: cartões das turmas (`GET /salas`), com disciplina, código, professor, período e, para o aluno, selos de pendências ("2 tarefas", "1 prova"); filtro de período para a gestão; busca.
3. `Sala.tsx`: cabeçalho da turma (`GET /salas/:turmaId`) e `Abas`: **Materiais** e **Plano de aula** (suas), **Tarefas** (`AbaTarefas` de `./Tarefas`, do g20), **Provas** (`AbaProvas` de `./Provas`, do g21) e, só com `podeEditar`, **Chamada** (`AbaChamada` de `./Chamada`, do g06). Todas recebem `PropsAba`. A aba ativa fica na query (`?aba=tarefas`) para os links dos avisos caírem no lugar certo. Para o aluno, um botão "Marcar presença" que leva a `/aluno/presenca`.
4. `Materiais.tsx`: materiais agrupados por tópico, cada um com título, descrição, link (abre em nova aba, com `rel="noopener noreferrer"`) e `ListaArquivos`; com `podeEditar`: "Novo material" (`Modal` com `CampoArquivos`), editar e excluir.
5. `Plano.tsx`: lista numerada dos temas com data prevista, objetivos e situação (ministrado em {data} ou pendente); barra de progresso "{ministradas} de {planejadas}"; com `podeEditar`: novo tema, editar, excluir, subir e descer (grava a ordem), e "Marcar como ministrado" escolhendo uma aula do diário (`GET /salas/:turmaId/aulas`).
6. `Andamento.tsx`: tabela por turma com barra de progresso, aulas registradas e última aula; filtro de período; `exportar="andamento"`.

### R8 (g20)

`AbaTarefas(props: PropsAba)`:

1. Professor e gestão: lista das tarefas com prazo, selo (aberta ou encerrada) e "{entregues} de {alunos} entregaram, {corrigidas} corrigidas"; com `podeEditar`: nova tarefa (`Modal`: título, enunciado, prazo com data e hora, nota máxima, aceitar atraso, avaliação do diário opcional, `CampoArquivos`), editar e excluir. Abrir uma tarefa mostra as entregas: tabela dos alunos (situação, data, atrasada, nota) e, ao clicar, a entrega (texto e arquivos) com o formulário de correção (nota e comentário).
2. Aluno: cartões das tarefas com prazo (e "faltam 2 dias" ou "atrasada"), situação em `Selo` e a nota quando corrigida; abrir mostra o enunciado, os anexos e o formulário de entrega (texto e `CampoArquivos`), que pode ser reenviado até a correção; depois de corrigida, a nota e o comentário do professor.

### R9 (g21)

`AbaProvas(props: PropsAba)`:

1. Professor e gestão: lista das provas (período, duração, publicada ou rascunho, "{enviadas} de {alunos}"); com `podeEditar`: nova prova e edição dos dados; **editor de questões** (adicionar objetiva, verdadeiro ou falso e dissertativa; alternativas com a certa marcada; pontos; reordenar; excluir; total de pontos sempre visível; salva tudo de uma vez); publicar e despublicar; resultados: tabela dos alunos com nota, e a correção das dissertativas de cada tentativa.
2. Aluno: cartões com o estado; "Iniciar prova" com confirmação (duração e aviso de que o tempo corre no servidor); **tela de realização**: uma questão por vez com navegação e mapa de questões respondidas, cronômetro calculado pelo `expiraEm` e pelo `agora` do servidor, salvamento automático a cada mudança (com espera de 1 s) e a cada 20 s, aviso antes de sair da página, envio com confirmação e envio automático quando o tempo acaba; depois: "Prova enviada", a nota quando houver e o gabarito quando liberado.

### R10 (g06)

1. `AbaChamada(props: PropsAba)`: escolher a aula do diário (`GET /salas/:turmaId/aulas`; se não houver aula hoje, orientar a registrar a aula no diário, com link para `/professor/diario/{turmaId}`), "Abrir chamada" (duração em minutos), e então o **QR code grande** (`QrCode` com o endereço `${window.location.origin}/aluno/presenca?t={token}`), o código para digitar em letras grandes, a contagem regressiva da troca, "{presentes} de {total}" e a lista dos alunos marcando presença em tempo real (consulta a cada 2 s, uma por vez, pausada com a aba oculta); "Encerrar chamada" com a opção de marcar falta para quem não respondeu. Botão de tela cheia para projetar.
2. `MarcarPresenca`: se a URL tem `?t=`, envia na hora; senão, campo para digitar o código (formato `12-345678`); mostra sucesso ("Presença registrada em {disciplina}") ou o erro devolvido, com "Tentar de novo".

### R11 (g01): dados de demonstração da sala de aula

Arquivo (só este): `server/prisma/seed-demo.ts`. No fim de `carregarDemonstracao`, sem alterar o que existe, para a turma BCC-ALG2-A de 2026.2 (professora Ana; alunos Marina e João) e, em menor volume, para uma turma do professor Bruno:

1. Quatro materiais em dois tópicos ("Unidade 1: ordenação", "Unidade 2: árvores"), com descrição e, em dois deles, link (`https://exemplo.escola.demo/...`). Sem arquivos (o seed não grava em disco).
2. Plano de aula com oito temas em ordem, datas previstas espalhadas pelo semestre; os três primeiros ligados a aulas do diário que já existam para a turma (se a turma não tiver aulas no seed, crie três aulas com conteúdo).
3. Três tarefas: uma com prazo vencido, entregue pelos dois e corrigida (nota e comentário), ligada a uma avaliação do diário só se já existir uma apropriada (senão sem vínculo); uma com prazo daqui a 5 dias, entregue só pela Marina (sem correção); uma com prazo daqui a 12 dias, sem entregas.
4. Duas provas publicadas: "Quiz de ordenação" já encerrada, com 5 questões (3 objetivas, 1 verdadeiro ou falso com `correta` 1 = verdadeiro, 1 dissertativa), `mostrarGabarito` ligado, tentativas enviadas dos dois alunos (uma já corrigida, com `notaFinal` coerente com os pontos; a outra com a dissertativa pendente); e "Prova de árvores" aberta agora (abre há 1 dia, fecha em 6 dias, 40 minutos, 6 questões objetivas), sem tentativas. Mais uma prova em rascunho (não publicada).
5. Valores coerentes: `notaObjetiva`, `notaFinal`, `pontos` das respostas e `expiraEm` conforme as regras do Contrato D. Datas determinísticas (deslocamentos a partir do instante da carga, como os blocos anteriores). Texto em português correto, neutro, sem dado real.
6. `cd server && npx tsc --noEmit`.

### R12 (g04): documentação da sexta leva

Arquivos (só estes): `README.md`, `INSTALAR.md`, `SECURITY.md`, `docs/API.md`, `docs/ARQUITETURA.md`, `CHANGELOG.md`. A partir do código real (`server/src/lib/arquivos.ts`, `server/src/lib/turmas.ts`, `server/src/modules/{arquivos,sala,tarefas,provas,chamada}/`, `client/src/modules/sala/`, `docker-compose.yml`, `client/nginx.conf`):

1. `docs/API.md`: módulos **arquivos**, **sala** (salas, materiais, plano, andamento), **tarefas**, **provas** e **chamada por QR**, com todas as rotas, formatos, códigos e regras (papéis na turma, prazos, tempo da prova no servidor, sigilo do gabarito, código rotativo).
2. `docs/ARQUITETURA.md`: seções "Arquivos enviados" (disco em `dados_arquivos`, vínculo por contexto, limpeza dos soltos), "Sala de aula" (papéis de `acessoTurma`), "Tarefas", "Provas online" (tentativa, expiração, correção automática e manual, nota no diário) e "Chamada por QR code"; entidades novas no modelo.
3. `SECURITY.md`: arquivos (tipos e tamanho aceitos, nome em disco aleatório, download com `nosniff` e como anexo, acesso por turma); provas (o gabarito não sai antes da hora, o tempo é do servidor; o que **não** é garantido: o sistema não impede consulta a material nem troca de respostas entre alunos); chamada (código de 20 segundos reduz, mas não elimina, o repasse do código a quem está fora da sala); **os arquivos enviados não entram na cópia de segurança do banco** (o volume `dados_arquivos` precisa de cópia à parte).
4. `README.md`: recursos novos por portal e uma subseção curta "Sala de aula".
5. `INSTALAR.md`: perguntas "Os arquivos enviados entram na cópia de segurança?" (não; como copiar o volume) e "Qual o tamanho máximo de arquivo?".
6. `CHANGELOG.md`: itens em 1.0.0, sem cabeçalho repetido.
7. Sem e-mail pessoal, caminho local, segredo nem promessa de CI.
