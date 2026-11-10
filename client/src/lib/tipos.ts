export type Perfil = 'ADMIN' | 'SECRETARIA' | 'PROFESSOR' | 'ALUNO';

export interface UsuarioLogado {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  alunoId: number | null;
  professorId: number | null;
}

export const NIVEIS: { valor: string; rotulo: string }[] = [
  { valor: 'FUNDAMENTAL_1', rotulo: 'Fundamental I' },
  { valor: 'FUNDAMENTAL_2', rotulo: 'Fundamental II' },
  { valor: 'MEDIO', rotulo: 'Ensino Médio' },
  { valor: 'TECNICO', rotulo: 'Técnico' },
  { valor: 'GRADUACAO', rotulo: 'Graduação' },
  { valor: 'ESPECIALIZACAO', rotulo: 'Especialização' },
  { valor: 'MESTRADO', rotulo: 'Mestrado' },
  { valor: 'DOUTORADO', rotulo: 'Doutorado' },
];

export function rotuloNivel(nivel: string): string {
  return NIVEIS.find((n) => n.valor === nivel)?.rotulo ?? nivel;
}
