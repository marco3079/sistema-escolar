// Formatos devolvidos pela API do módulo pos (contrato 5.6) e de outros módulos consumidos

export type StatusProjeto = 'EM_ELABORACAO' | 'QUALIFICADO' | 'APROVADO' | 'REPROVADO';
export type TipoBanca = 'QUALIFICACAO' | 'DEFESA';
export type ResultadoBanca = 'PENDENTE' | 'APROVADO' | 'APROVADO_COM_RESSALVAS' | 'REPROVADO';
export type PapelBanca = 'PRESIDENTE' | 'INTERNO' | 'EXTERNO' | 'SUPLENTE';

export interface MembroBancaDTO {
  id: number;
  bancaId: number;
  professorId: number | null;
  nomeExterno: string | null;
  instituicao: string | null;
  papel: PapelBanca;
  professor: { id: number; usuario: { nome: string } } | null;
}

export interface BancaDTO {
  id: number;
  projetoId: number;
  tipo: TipoBanca;
  data: string;
  local: string | null;
  resultado: ResultadoBanca;
  parecer: string | null;
  membros: MembroBancaDTO[];
}

export interface ProjetoDTO {
  id: number;
  matriculaId: number;
  orientadorId: number;
  coorientadorId: number | null;
  titulo: string;
  resumo: string;
  linhaPesquisa: string | null;
  status: StatusProjeto;
  criadoEm: string;
  matricula: {
    id: number;
    aluno: { ra: string; usuario: { nome: string } };
    curso: { id: number; nome: string; nivel: string };
  };
  orientador: { id: number; usuario: { nome: string } };
  coorientador: { id: number; usuario: { nome: string } } | null;
  bancas: BancaDTO[];
}

// MatriculaDTO (módulo matricula, contrato 5.4), campos usados aqui
export interface MatriculaDTO {
  id: number;
  status: string;
  serieAtual: number;
  aluno: { id: number; ra: string; usuario: { nome: string } };
  curso: { id: number; nome: string; nivel: string; regime: string };
}

// ProfessorDTO (módulo cadastros, contrato 5.2), campos usados aqui
export interface ProfessorDTO {
  id: number;
  registro: string;
  titulacao: string;
  area: string | null;
  usuario: { id: number; nome: string; email: string; ativo: boolean };
}
