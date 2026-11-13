// Formatos do portal dos responsáveis (Contrato A: rotas /familia e /alunos/:id/responsaveis).

export const PARENTESCOS: string[] = ['Mãe', 'Pai', 'Avó', 'Avô', 'Tio(a)', 'Tutor(a)', 'Outro'];

export type StatusMensalidadeFamilia = 'ABERTA' | 'PAGA' | 'ATRASADA' | 'CANCELADA';

// GET /familia/alunos: um item por vínculo do responsável.
export interface MatriculaFamilia {
  id: number;
  curso: string;
  nivel: string;
  status: string;
  serieAtual: number;
}

export interface AlunoFamilia {
  alunoId: number;
  nome: string;
  ra: string;
  foto: string | null;
  idade: number;
  parentesco: string;
  financeiro: boolean;
  matriculas: MatriculaFamilia[];
  resumo: {
    mediaGeral: number | null;
    frequenciaMedia: number | null;
    mensalidadesAbertas: number;
    mensalidadesAtrasadas: number;
    ocorrenciasSemCiencia: number;
  };
}

// GET /familia/alunos/:alunoId/boletim (mesmo formato do BoletimDTO do diário).
export interface MatriculaBoletim {
  id: number;
  status: string;
  aluno: { id: number; ra: string; usuario: { nome: string } };
  curso: { id: number; nome: string; nivel: string; regime: string };
  periodoIngresso: { id: number; nome: string };
}

export type StatusInscricaoFamilia = 'CURSANDO' | 'APROVADO' | 'REPROVADO_NOTA' | 'REPROVADO_FALTA' | 'TRANCADO';

export interface ItemBoletimFamilia {
  inscricaoId: number;
  disciplina: string;
  codigo: string;
  turma: string;
  professor: string;
  avaliacoes: { nome: string; peso: number; notaMaxima: number; valor: number | null }[];
  notaFinal: number | null;
  frequencia: number | null;
  status: StatusInscricaoFamilia;
}

export interface BoletimFamilia {
  matricula: MatriculaBoletim;
  periodos: { periodo: { id: number; nome: string }; itens: ItemBoletimFamilia[] }[];
}

// GET /familia/alunos/:alunoId/frequencia
export interface FrequenciaDisciplina {
  turmaId: number;
  turma: string;
  disciplina: string;
  aulas: number;
  presencas: number;
  faltas: number;
  percentual: number | null;
  ultimasFaltas: string[]; // AAAA-MM-DD, até 5
}

// GET /familia/alunos/:alunoId/mensalidades (só com financeiro)
export interface MensalidadeFamilia {
  id: number;
  competencia: string;
  vencimento: string;
  valor: number;
  desconto: number;
  valorFinal: number;
  status: StatusMensalidadeFamilia;
  pagoEm: string | null;
}

// GET /responsaveis (gestão)
export interface ResponsavelGestao {
  usuarioId: number;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  alunos: { vinculoId: number; alunoId: number; nome: string; ra: string; parentesco: string }[];
}

// GET /alunos/:alunoId/responsaveis (gestão)
export interface VinculoResponsavel {
  vinculoId: number;
  usuarioId: number;
  nome: string;
  email: string;
  telefone: string | null;
  parentesco: string;
  financeiro: boolean;
  ativo: boolean;
}

// POST /alunos/:alunoId/responsaveis (201)
export interface ResultadoVinculo {
  vinculoId: number;
  usuarioId: number;
  usuarioCriado: boolean;
  senhaInicial: string | null;
  conviteEnviado: boolean;
}

// ---------- Auxiliares compartilhados pelas telas do módulo ----------

export const FREQUENCIA_MINIMA = 75;

const NIVEIS_POS_GRADUACAO: string[] = ['ESPECIALIZACAO', 'MESTRADO', 'DOUTORADO'];

// Média mínima de aprovação: 7 na pós-graduação, 6 nos demais (regra do boletim do diário).
export function mediaMinimaDoNivel(nivel: string): number {
  return NIVEIS_POS_GRADUACAO.includes(nivel) ? 7 : 6;
}

export function formatarNumeroFamilia(n: number | null, casas = 1): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(casas).replace('.', ',');
}

export function formatarPercentualFamilia(n: number | null): string {
  return n === null || n === undefined ? '—' : `${formatarNumeroFamilia(n)}%`;
}

export function limitarPercentual(valor: number): number {
  return Math.min(100, Math.max(0, valor));
}

export function mensagemDeErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

export function normalizarBuscaFamilia(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
