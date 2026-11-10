import type { MembroBancaDTO, PapelBanca, ProfessorDTO, ResultadoBanca, StatusProjeto, TipoBanca } from './tipos';

export type CorSelo = 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza';

export const NIVEIS_POS = ['ESPECIALIZACAO', 'MESTRADO', 'DOUTORADO'];

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

export const STATUS_PROJETO: { valor: StatusProjeto; rotulo: string; cor: CorSelo }[] = [
  { valor: 'EM_ELABORACAO', rotulo: 'Em elaboração', cor: 'cinza' },
  { valor: 'QUALIFICADO', rotulo: 'Qualificado', cor: 'azul' },
  { valor: 'APROVADO', rotulo: 'Aprovado', cor: 'verde' },
  { valor: 'REPROVADO', rotulo: 'Reprovado', cor: 'vermelho' },
];

export const TIPOS_BANCA: { valor: TipoBanca; rotulo: string }[] = [
  { valor: 'QUALIFICACAO', rotulo: 'Qualificação' },
  { valor: 'DEFESA', rotulo: 'Defesa' },
];

export const RESULTADOS_BANCA: { valor: ResultadoBanca; rotulo: string; cor: CorSelo }[] = [
  { valor: 'PENDENTE', rotulo: 'Pendente', cor: 'cinza' },
  { valor: 'APROVADO', rotulo: 'Aprovado', cor: 'verde' },
  { valor: 'APROVADO_COM_RESSALVAS', rotulo: 'Aprovado com ressalvas', cor: 'amarelo' },
  { valor: 'REPROVADO', rotulo: 'Reprovado', cor: 'vermelho' },
];

export const PAPEIS_BANCA: { valor: PapelBanca; rotulo: string }[] = [
  { valor: 'PRESIDENTE', rotulo: 'Presidente' },
  { valor: 'INTERNO', rotulo: 'Membro interno' },
  { valor: 'EXTERNO', rotulo: 'Membro externo' },
  { valor: 'SUPLENTE', rotulo: 'Suplente' },
];

export function rotuloStatus(status: StatusProjeto): string {
  return STATUS_PROJETO.find((s) => s.valor === status)?.rotulo ?? status;
}

export function corStatus(status: StatusProjeto): CorSelo {
  return STATUS_PROJETO.find((s) => s.valor === status)?.cor ?? 'cinza';
}

export function rotuloTipoBanca(tipo: TipoBanca): string {
  return TIPOS_BANCA.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

export function rotuloResultado(resultado: ResultadoBanca): string {
  return RESULTADOS_BANCA.find((r) => r.valor === resultado)?.rotulo ?? resultado;
}

export function corResultado(resultado: ResultadoBanca): CorSelo {
  return RESULTADOS_BANCA.find((r) => r.valor === resultado)?.cor ?? 'cinza';
}

export function rotuloPapel(papel: PapelBanca): string {
  return PAPEIS_BANCA.find((p) => p.valor === papel)?.rotulo ?? papel;
}

export function nomeMembro(membro: MembroBancaDTO): string {
  if (membro.professor) return membro.professor.usuario.nome;
  const instituicao = membro.instituicao ? ` (${membro.instituicao})` : '';
  return `${membro.nomeExterno ?? 'Sem nome'}${instituicao}`;
}

export function opcoesProfessores(lista: ProfessorDTO[] | null): { valor: string; rotulo: string }[] {
  return (lista ?? []).map((p) => ({ valor: String(p.id), rotulo: p.usuario.nome }));
}
