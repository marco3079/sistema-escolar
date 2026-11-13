export type Perfil = 'ADMIN' | 'SECRETARIA' | 'PROFESSOR' | 'ALUNO' | 'RESPONSAVEL';

// Perfil verdadeiro do usuário. TI tem o mesmo acesso do ADMIN, mas aparece como "TI".
export type PerfilReal = Perfil | 'TI';

export interface UsuarioLogado {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil; // efetivo: 'ADMIN' para TI
  perfilReal: PerfilReal; // perfil verdadeiro, usado só para mostrar o papel
  alunoId: number | null;
  professorId: number | null;
  foto: string | null; // data URL ou endereço http(s); null sem foto
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
