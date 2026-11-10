// Tipos do módulo agenda (formato dos DTOs do contrato, seção 5.9 e 5.3).

export interface HorarioDTO {
  id: number;
  turmaId: number;
  diaSemana: number; // 1 = segunda ... 6 = sábado, 7 = domingo
  horaInicio: string; // "HH:MM"
  horaFim: string; // "HH:MM"
  sala: string | null;
  turma: {
    id: number;
    codigo: string;
    grupo: string | null;
    sala: string | null;
    disciplina: { nome: string };
    professor: { usuario: { nome: string } };
    periodoLetivo: { id: number; nome: string };
  };
}

export type TipoEvento = 'LETIVO' | 'FERIADO' | 'PROVA' | 'EVENTO' | 'RECESSO';

export interface EventoCalendario {
  id: number;
  titulo: string;
  descricao: string | null;
  inicio: string; // ISO
  fim: string; // ISO
  tipo: TipoEvento;
  periodoLetivoId: number | null;
}

// Turma como vem de GET /turmas e GET /turmas/minhas (TurmaDTO, seção 5.3), só os campos usados aqui.
export interface TurmaResumo {
  id: number;
  codigo: string;
  grupo: string | null;
  disciplina: { nome: string };
  periodoLetivo: { id: number; nome: string };
}

// Período de GET /periodos-letivos, só os campos usados aqui.
export interface PeriodoResumo {
  id: number;
  nome: string;
  ativo: boolean;
}

export const DIAS_SEMANA: { valor: number; rotulo: string }[] = [
  { valor: 1, rotulo: 'Segunda-feira' },
  { valor: 2, rotulo: 'Terça-feira' },
  { valor: 3, rotulo: 'Quarta-feira' },
  { valor: 4, rotulo: 'Quinta-feira' },
  { valor: 5, rotulo: 'Sexta-feira' },
  { valor: 6, rotulo: 'Sábado' },
  { valor: 7, rotulo: 'Domingo' },
];

export const TIPOS_EVENTO: { valor: TipoEvento; rotulo: string }[] = [
  { valor: 'LETIVO', rotulo: 'Letivo' },
  { valor: 'FERIADO', rotulo: 'Feriado' },
  { valor: 'PROVA', rotulo: 'Prova' },
  { valor: 'EVENTO', rotulo: 'Evento' },
  { valor: 'RECESSO', rotulo: 'Recesso' },
];
