import { Selo, formatarData } from '../../ui';
import type { ArquivoDTO } from '../../lib/arquivos';

// ---------- Tipos (Contrato C de docs/plano/sexta-leva.md) ----------

export interface EntregaDTO {
  id: number;
  texto: string;
  entregueEm: string;
  atrasada: boolean;
  nota: number | null;
  comentario: string;
  corrigidaEm: string | null;
  arquivos: ArquivoDTO[];
}

export interface TarefaDTO {
  id: number;
  titulo: string;
  enunciado: string;
  prazo: string;
  notaMaxima: number;
  aceitaAtraso: boolean;
  avaliacaoId: number | null;
  criadaEm: string;
  arquivos: ArquivoDTO[];
  // só para aluno:
  situacao?: 'PENDENTE' | 'ENTREGUE' | 'CORRIGIDA' | 'ENCERRADA';
  minhaEntrega?: EntregaDTO | null;
  // só para professor e gestão:
  resumo?: { alunos: number; entregues: number; corrigidas: number };
}

// GET /tarefas/:id/entregas
export interface EntregaAluno {
  inscricaoId: number;
  aluno: { nome: string; ra: string };
  entrega: EntregaDTO | null;
}

// GET /salas/:turmaId/avaliacoes
export interface AvaliacaoOpcao {
  id: number;
  nome: string;
  notaMaxima: number;
}

// ---------- Limites (espelham o servidor) ----------

export const TITULO_MIN = 2;
export const TITULO_MAX = 120;
export const ENUNCIADO_MAX = 10000;
export const TEXTO_ENTREGA_MAX = 10000;
export const COMENTARIO_MAX = 2000;
export const NOTA_MAXIMA_MIN = 0.1;
export const NOTA_MAXIMA_MAX = 100;
export const MAX_ARQUIVOS = 10;

// ---------- Datas e números ----------

// ISO (UTC) -> valor de input datetime-local (horário do navegador).
export function paraCampoDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Valor de datetime-local -> ISO. Devolve null se o valor não for uma data válida.
export function deCampoDataHora(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Texto de número com vírgula decimal (pt-BR), no máximo 2 casas.
export function formatarNota(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// Converte o texto digitado ("8,5" ou "8.5") em número; NaN se inválido.
export function lerNumero(texto: string): number {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '') return NaN;
  return Number(limpo);
}

export function prazoPassou(prazo: string, agora: number = Date.now()): boolean {
  return new Date(prazo).getTime() <= agora;
}

// "faltam 2 dias", "faltam 5 h", "faltam 30 min"; "atrasada" depois do prazo.
export function descreverPrazo(prazo: string, agora: number = Date.now()): string {
  const restante = new Date(prazo).getTime() - agora;
  if (Number.isNaN(restante)) return '';
  if (restante <= 0) return 'atrasada';
  const minutos = Math.floor(restante / 60000);
  if (minutos < 60) return `faltam ${Math.max(1, minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `faltam ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

export function formatarPrazo(prazo: string): string {
  return formatarData(prazo) + ' ' + new Date(prazo).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------- Selos ----------

// Situação do aluno (TarefaDTO.situacao).
export function SeloSituacao({ situacao }: { situacao: NonNullable<TarefaDTO['situacao']> }) {
  switch (situacao) {
    case 'PENDENTE':
      return <Selo cor="azul">Pendente</Selo>;
    case 'ENTREGUE':
      return <Selo cor="amarelo">Entregue</Selo>;
    case 'CORRIGIDA':
      return <Selo cor="verde">Corrigida</Selo>;
    case 'ENCERRADA':
      return <Selo cor="vermelho">Encerrada</Selo>;
  }
}

// Aberta ou encerrada, do ponto de vista do professor (pelo prazo).
export function SeloAberta({ prazo }: { prazo: string }) {
  return prazoPassou(prazo) ? <Selo cor="cinza">Encerrada</Selo> : <Selo cor="verde">Aberta</Selo>;
}

// Situação de uma entrega na tabela do professor.
export function SeloEntrega({ entrega }: { entrega: EntregaDTO | null }) {
  if (!entrega) return <Selo cor="vermelho">Não entregou</Selo>;
  if (entrega.corrigidaEm) return <Selo cor="verde">Corrigida</Selo>;
  return <Selo cor="amarelo">Entregue</Selo>;
}
