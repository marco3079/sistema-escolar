// Tipos de resposta do módulo acadêmico (formato dos contratos 5.2 e 5.3).

export type RegimeCurso = 'SERIADO' | 'CREDITOS';
export type TipoPeriodo = 'ANUAL' | 'SEMESTRAL';

export interface Curso {
  id: number;
  nome: string;
  codigo: string;
  nivel: string;
  regime: RegimeCurso;
  duracaoPeriodos: number;
  cargaHorariaTotal: number;
  mensalidade: number;
  ativo: boolean;
}

export interface PreRequisito {
  id: number;
  nome: string;
  codigo: string;
}

export interface Disciplina {
  id: number;
  cursoId: number;
  nome: string;
  codigo: string;
  cargaHoraria: number;
  creditos: number;
  periodoSugerido: number;
  obrigatoria: boolean;
  preRequisitos: PreRequisito[];
}

export interface CursoDetalhe extends Curso {
  disciplinas: Disciplina[];
}

export interface PeriodoLetivo {
  id: number;
  nome: string;
  ano: number;
  tipo: TipoPeriodo;
  inicio: string;
  fim: string;
  ativo: boolean;
}

export interface TurmaDTO {
  id: number;
  codigo: string;
  disciplinaId: number;
  periodoLetivoId: number;
  professorId: number;
  grupo: string | null;
  vagas: number;
  sala: string | null;
  disciplina: {
    id: number;
    nome: string;
    codigo: string;
    creditos: number;
    cursoId: number;
    curso: { id: number; nome: string; nivel: string; regime: RegimeCurso };
  };
  professor: { id: number; usuario: { nome: string } };
  periodoLetivo: { id: number; nome: string };
  _count: { inscricoes: number };
}

export interface ProfessorDTO {
  id: number;
  registro: string;
  titulacao: string;
  usuario: { nome: string };
}
