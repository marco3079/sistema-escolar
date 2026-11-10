import type { NivelEnsino, StatusInscricao } from '@prisma/client';

export const FREQUENCIA_MINIMA = 75;

const NIVEIS_POS: NivelEnsino[] = ['ESPECIALIZACAO', 'MESTRADO', 'DOUTORADO'];

export function mediaMinima(nivel: NivelEnsino): number {
  return NIVEIS_POS.includes(nivel) ? 7 : 6;
}

export function calcularSituacao(
  nivel: NivelEnsino,
  notaFinal: number,
  frequencia: number
): StatusInscricao {
  if (frequencia < FREQUENCIA_MINIMA) return 'REPROVADO_FALTA';
  if (notaFinal < mediaMinima(nivel)) return 'REPROVADO_NOTA';
  return 'APROVADO';
}

export function ehPos(nivel: NivelEnsino): boolean {
  return NIVEIS_POS.includes(nivel);
}
