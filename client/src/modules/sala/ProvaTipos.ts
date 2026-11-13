// Tipos e funções da aba de provas (Contrato D, docs/plano/sexta-leva.md).

export type TipoQuestao = 'OBJETIVA' | 'VERDADEIRO_FALSO' | 'DISSERTATIVA';

export const ROTULO_TIPO_QUESTAO: Record<TipoQuestao, string> = {
  OBJETIVA: 'Objetiva',
  VERDADEIRO_FALSO: 'Verdadeiro ou falso',
  DISSERTATIVA: 'Dissertativa',
};

// Questão como o professor edita (inclui a alternativa correta).
export interface QuestaoEdicao {
  id?: number;
  tipo: TipoQuestao;
  enunciado: string;
  alternativas: string[];
  correta: number | null;
  pontos: number;
}

// Questão como o aluno recebe (nunca traz `correta`).
export interface QuestaoAluno {
  id: number;
  ordem: number;
  tipo: TipoQuestao;
  enunciado: string;
  alternativas: string[];
  pontos: number;
}

export type EstadoProvaAluno = 'AGENDADA' | 'ABERTA' | 'EM_ANDAMENTO' | 'ENVIADA' | 'ENCERRADA';

export interface ProvaDTO {
  id: number;
  titulo: string;
  instrucoes: string;
  abreEm: string;
  fechaEm: string;
  duracaoMin: number;
  embaralhar: boolean;
  notaMaxima: number;
  mostrarGabarito: boolean;
  publicada: boolean;
  avaliacaoId: number | null;
  totalQuestoes: number;
  totalPontos: number;
  // só para aluno:
  estado?: EstadoProvaAluno;
  minhaNota?: number | null;
  // só para professor e gestão:
  questoes?: QuestaoEdicao[];
  resumo?: { alunos: number; enviadas: number; corrigidas: number; temTentativa: boolean };
}

export interface AvaliacaoOpcao {
  id: number;
  nome: string;
  notaMaxima: number;
}

export interface RespostaAluno {
  questaoId: number;
  alternativa: number | null;
  texto: string;
}

export interface TentativaAluno {
  id: number;
  iniciadaEm: string;
  expiraEm: string;
  enviadaEm: string | null;
}

// POST /provas/:id/iniciar
export interface IniciarProvaResposta {
  tentativa: TentativaAluno;
  agora: string;
  questoes: QuestaoAluno[];
  respostas: RespostaAluno[];
}

// POST /provas/:id/enviar
export interface EnviarProvaResposta {
  enviadaEm: string;
  corrigida: boolean;
  notaFinal: number | null;
}

// Item do gabarito (GET /provas/:id/minha e detalhe da tentativa).
export interface ItemGabarito {
  questaoId: number;
  enunciado: string;
  tipo: TipoQuestao;
  alternativas: string[];
  correta: number | null;
  minhaAlternativa: number | null;
  meuTexto: string | null;
  pontos: number;
  pontosObtidos: number | null;
  comentario: string | null;
}

// GET /provas/:id/minha
export interface MinhaProvaResposta {
  tentativa: TentativaAluno | null;
  corrigida: boolean;
  notaFinal: number | null;
  gabarito: ItemGabarito[] | null;
}

// GET /provas/:id/tentativas
export interface TentativaLinha {
  inscricaoId: number;
  aluno: { nome: string; ra: string };
  tentativa: null | {
    id: number;
    iniciadaEm: string;
    enviadaEm: string | null;
    corrigida: boolean;
    notaObjetiva: number | null;
    notaFinal: number | null;
    pendentes: number;
  };
}

// Questão da tentativa (com a ordem original da prova; pontosObtidos nulo se a dissertativa não foi corrigida).
export interface ItemTentativa extends ItemGabarito {
  ordem: number;
}

// GET /tentativas/:id (formato oficial, implementado pelo g17).
export interface TentativaDetalhe {
  id: number;
  provaId: number;
  aluno: { nome: string; ra: string };
  iniciadaEm: string;
  enviadaEm: string | null;
  corrigida: boolean;
  notaObjetiva: number | null;
  notaFinal: number | null;
  questoes: ItemTentativa[];
}

// Verdadeiro ou falso: convenção do schema (ProvaQuestao.correta e ProvaResposta.alternativa).
export const VF_VERDADEIRO = 1;
export const VF_FALSO = 0;

export function rotuloVF(valor: number): string {
  return valor === VF_VERDADEIRO ? "Verdadeiro" : "Falso";
}

// ---------- Funções ----------

export const LIMITE_PARA_SALVAR_MS = 1000;
export const INTERVALO_SALVAR_MS = 20000;
export const TOLERANCIA_EXPIRA_MS = 15000;
// Envio automático ao acabar o tempo: novas tentativas em caso de falha (3 vezes, 3 s entre elas).
export const MAXIMO_REENVIOS_AUTOMATICOS = 3;
export const INTERVALO_REENVIO_MS = 3000;

// Converte um ISO vindo da API no valor de <input type="datetime-local"> (horário local).
export function isoParaInputDataHora(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Converte o valor de <input type="datetime-local"> em ISO (UTC). Vazio ou inválido: null.
export function inputDataHoraParaIso(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// "1 ponto" ou "2 pontos" (valor já formatado: 0,5 vira "0,5 pontos").
export function rotuloPontos(n: number): string {
  return `${formatarNumero(n)} ${n === 1 ? "ponto" : "pontos"}`;
}

// Número com até duas casas e vírgula (nota e pontos).
export function formatarNumero(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Tempo restante em mm:ss, ou h:mm:ss quando passa de uma hora.
export function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Soma de pontos de uma lista de questões (ou da prova).
export function totalPontosDe(questoes: { pontos: number }[]): number {
  return questoes.reduce((soma, q) => soma + (Number.isFinite(q.pontos) ? q.pontos : 0), 0);
}

// Uma questão pode ser respondida (tem resposta de alternativa ou texto preenchido).
export function questaoRespondida(q: QuestaoAluno, r: RespostaAluno | undefined): boolean {
  if (!r) return false;
  if (q.tipo === 'DISSERTATIVA') return r.texto.trim() !== '';
  return r.alternativa !== null && r.alternativa !== undefined;
}

// Texto de erro vindo de uma exceção.
export function mensagemErroProva(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Rótulo e cor do estado da prova do aluno.
export function rotuloEstadoAluno(estado: EstadoProvaAluno | undefined): {
  rotulo: string;
  cor: 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza';
} {
  switch (estado) {
    case 'AGENDADA':
      return { rotulo: 'Agendada', cor: 'cinza' };
    case 'ABERTA':
      return { rotulo: 'Aberta', cor: 'azul' };
    case 'EM_ANDAMENTO':
      return { rotulo: 'Em andamento', cor: 'amarelo' };
    case 'ENVIADA':
      return { rotulo: 'Enviada', cor: 'verde' };
    case 'ENCERRADA':
      return { rotulo: 'Encerrada', cor: 'vermelho' };
    default:
      return { rotulo: '—', cor: 'cinza' };
  }
}
