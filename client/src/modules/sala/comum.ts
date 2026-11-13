// Tipos compartilhados do módulo Sala de aula (Contrato B e Contrato F).

export type Papel = 'PROFESSOR' | 'GESTAO' | 'ALUNO';

// Props recebidas por cada aba da turma (Materiais, Plano, Tarefas, Provas e Chamada).
export interface PropsAba {
  turmaId: number;
  papel: Papel;
  podeEditar: boolean;
  // Prefixo do portal: '/admin', '/professor' ou '/aluno'.
  base: string;
}

// Item de GET /salas (uma turma na lista de salas).
export interface SalaResumo {
  id: number;
  codigo: string;
  disciplina: { nome: string; codigo: string };
  periodoLetivo: { id: number; nome: string };
  professor: { nome: string };
  papel: Papel;
  pendencias: { tarefas: number; provas: number };
}

// Resposta de GET /salas/:turmaId (cabeçalho da turma).
export interface SalaDetalhe extends SalaResumo {
  podeEditar: boolean;
  alunos: number;
}
