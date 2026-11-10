// Auxiliares do módulo acadêmico (rótulos e conversões).
import type { RegimeCurso, TipoPeriodo } from './tipos';

export const REGIMES: { valor: RegimeCurso; rotulo: string }[] = [
  { valor: 'SERIADO', rotulo: 'Seriado' },
  { valor: 'CREDITOS', rotulo: 'Por créditos' },
];

export const TIPOS_PERIODO: { valor: TipoPeriodo; rotulo: string }[] = [
  { valor: 'ANUAL', rotulo: 'Anual' },
  { valor: 'SEMESTRAL', rotulo: 'Semestral' },
];

export function rotuloRegime(regime: string): string {
  return REGIMES.find((r) => r.valor === regime)?.rotulo ?? regime;
}

export function rotuloTipoPeriodo(tipo: string): string {
  return TIPOS_PERIODO.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

// No seriado a unidade é "série"; por créditos, "semestre".
export function unidadeDoRegime(regime: string): string {
  return regime === 'SERIADO' ? 'Série' : 'Semestre';
}

export function duracaoTexto(duracao: number, regime: string): string {
  const unidade = unidadeDoRegime(regime).toLowerCase();
  if (duracao === 1) return `1 ${unidade}`;
  return `${duracao} ${unidade === 'série' ? 'séries' : 'semestres'}`;
}

// Converte o texto de um campo numérico (aceita vírgula decimal).
export function numeroDe(texto: string): number {
  return Number(texto.replace(',', '.'));
}

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Data ISO do servidor (aaaa-mm-ddT...) -> aaaa-mm-dd sem deslocar o dia pelo fuso.
export function dataDoIso(iso: string): string {
  return iso.slice(0, 10);
}
