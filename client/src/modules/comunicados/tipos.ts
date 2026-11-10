// Tipos do módulo comunicados (formato do ComunicadoDTO, seção 5.10).

export type PublicoComunicado = 'TODOS' | 'ALUNOS' | 'PROFESSORES' | 'TURMA' | 'CURSO';

export interface ComunicadoDTO {
  id: number;
  titulo: string;
  corpo: string;
  autorId: number;
  autor: { nome: string };
  publicadoEm: string; // ISO
  publico: PublicoComunicado;
  turmaId: number | null;
  turma: { codigo: string } | null;
  cursoId: number | null;
  curso: { nome: string } | null;
  lido: boolean;
}

// Turma como vem de GET /turmas e GET /turmas/minhas (TurmaDTO, seção 5.3), só os campos usados aqui.
export interface TurmaResumo {
  id: number;
  codigo: string;
  grupo: string | null;
  disciplina: { nome: string };
}

// Curso como vem de GET /cursos, só os campos usados aqui.
export interface CursoResumo {
  id: number;
  nome: string;
}

export const PUBLICOS: { valor: PublicoComunicado; rotulo: string }[] = [
  { valor: 'TODOS', rotulo: 'Toda a escola' },
  { valor: 'ALUNOS', rotulo: 'Alunos' },
  { valor: 'PROFESSORES', rotulo: 'Professores' },
  { valor: 'TURMA', rotulo: 'Turma' },
  { valor: 'CURSO', rotulo: 'Curso' },
];

export function rotuloPublico(comunicado: ComunicadoDTO): string {
  switch (comunicado.publico) {
    case 'TODOS':
      return 'Toda a escola';
    case 'ALUNOS':
      return 'Alunos';
    case 'PROFESSORES':
      return 'Professores';
    case 'TURMA':
      return `Turma ${comunicado.turma?.codigo ?? ''}`.trim();
    case 'CURSO':
      return `Curso ${comunicado.curso?.nome ?? ''}`.trim();
  }
}
