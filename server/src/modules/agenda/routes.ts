import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';

const router = Router();

const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_ID = /^\d+$/;

const incluirHorario = {
  turma: {
    select: {
      id: true,
      codigo: true,
      grupo: true,
      sala: true,
      disciplina: { select: { nome: true } },
      professor: { select: { usuario: { select: { nome: true } } } },
      periodoLetivo: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.HorarioAulaInclude;

// Parâmetros de query vazios (ex.: "?grupo=") equivalem a não informar o filtro.
const textoQuery = z
  .union([z.literal('').transform(() => undefined), z.string()])
  .optional();
const idQuery = z
  .union([z.literal('').transform(() => undefined), z.string().regex(REGEX_ID, 'Id inválido')])
  .optional();
const dataQuery = z
  .union([
    z.literal('').transform(() => undefined),
    z.string().regex(REGEX_DATA, 'Use a data no formato AAAA-MM-DD'),
  ])
  .optional();

function normalizarTexto(sala: string | null | undefined): string | null {
  const limpa = sala?.trim();
  return limpa ? limpa : null;
}

const horarioSchema = z.object({
  turmaId: z.number().int().positive(),
  diaSemana: z.number().int().min(1).max(7),
  horaInicio: z.string().regex(REGEX_HORA, 'Use o formato HH:MM'),
  horaFim: z.string().regex(REGEX_HORA, 'Use o formato HH:MM'),
  sala: z.string().nullable().optional(),
});

const filtroHorarioSchema = z.object({
  turmaId: idQuery,
  periodoLetivoId: idQuery,
  grupo: textoQuery,
});

const dataIsoSchema = z
  .string()
  .refine((valor) => !Number.isNaN(Date.parse(valor)), 'Data inválida');

const eventoSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título'),
  descricao: z.string().nullable().optional(),
  inicio: dataIsoSchema,
  fim: dataIsoSchema,
  tipo: z.enum(['LETIVO', 'FERIADO', 'PROVA', 'EVENTO', 'RECESSO']),
  periodoLetivoId: z.number().int().positive().nullable().optional(),
});

const filtroCalendarioSchema = z.object({
  de: dataQuery,
  ate: dataQuery,
});

// Choque: mesmo dia e período letivo, intervalo sobreposto, mesmo professor ou mesma sala.
async function verificarChoque(
  turma: { periodoLetivoId: number; professorId: number; sala: string | null },
  diaSemana: number,
  horaInicio: string,
  horaFim: string,
  salaDoHorario: string | null
): Promise<void> {
  const salaNova = salaDoHorario ?? normalizarTexto(turma.sala);
  const existentes = await prisma.horarioAula.findMany({
    where: { diaSemana, turma: { periodoLetivoId: turma.periodoLetivoId } },
    include: { turma: { select: { professorId: true, sala: true } } },
  });

  for (const existente of existentes) {
    const sobrepoe = horaInicio < existente.horaFim && horaFim > existente.horaInicio;
    if (!sobrepoe) continue;

    if (existente.turma.professorId === turma.professorId) {
      throw new HttpError(409, 'Professor já tem aula nesse horário');
    }

    const salaExistente = normalizarTexto(existente.sala) ?? normalizarTexto(existente.turma.sala);
    if (salaNova && salaExistente === salaNova) {
      throw new HttpError(409, 'Sala ocupada nesse horário');
    }
  }
}

// Rotas fixas antes das rotas com parâmetro.
router.get(
  '/horarios/meus',
  permitir('PROFESSOR', 'ALUNO'),
  asyncHandler(async (req, res) => {
    const { perfil, professorId, alunoId } = req.usuario;
    let filtroTurma: Prisma.TurmaWhereInput;

    if (perfil === 'PROFESSOR') {
      if (professorId === null) {
        throw new HttpError(403, 'Sem permissão');
      }
      filtroTurma = { professorId, periodoLetivo: { ativo: true } };
    } else {
      if (alunoId === null) {
        throw new HttpError(403, 'Sem permissão');
      }
      filtroTurma = {
        inscricoes: { some: { status: 'CURSANDO', matricula: { alunoId } } },
      };
    }

    const horarios = await prisma.horarioAula.findMany({
      where: { turma: filtroTurma },
      include: incluirHorario,
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
    res.json(horarios);
  })
);

router.get(
  '/horarios',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const filtro = validar(filtroHorarioSchema, req.query);
    const horarios = await prisma.horarioAula.findMany({
      where: {
        turmaId: filtro.turmaId !== undefined ? Number(filtro.turmaId) : undefined,
        turma: {
          periodoLetivoId:
            filtro.periodoLetivoId !== undefined ? Number(filtro.periodoLetivoId) : undefined,
          grupo: filtro.grupo,
        },
      },
      include: incluirHorario,
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
    res.json(horarios);
  })
);

router.post(
  '/horarios',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(horarioSchema, req.body);
    if (dados.horaFim <= dados.horaInicio) {
      throw new HttpError(400, 'A hora de fim deve ser depois da hora de início');
    }

    const turma = await prisma.turma.findUnique({
      where: { id: dados.turmaId },
      select: { periodoLetivoId: true, professorId: true, sala: true },
    });
    if (!turma) {
      throw new HttpError(404, 'Turma não encontrada');
    }

    const sala = normalizarTexto(dados.sala);
    await verificarChoque(turma, dados.diaSemana, dados.horaInicio, dados.horaFim, sala);

    const horario = await prisma.horarioAula.create({
      data: {
        turmaId: dados.turmaId,
        diaSemana: dados.diaSemana,
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
        sala,
      },
      include: incluirHorario,
    });
    res.status(201).json(horario);
  })
);

router.delete(
  '/horarios/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const existente = await prisma.horarioAula.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      throw new HttpError(404, 'Horário não encontrado');
    }
    await prisma.horarioAula.delete({ where: { id } });
    res.status(204).end();
  })
);

router.get(
  '/calendario',
  asyncHandler(async (req, res) => {
    const filtro = validar(filtroCalendarioSchema, req.query);
    const where: Prisma.EventoCalendarioWhereInput = {};
    if (filtro.de !== undefined) {
      where.fim = { gte: new Date(`${filtro.de}T00:00:00`) };
    }
    if (filtro.ate !== undefined) {
      where.inicio = { lte: new Date(`${filtro.ate}T23:59:59.999`) };
    }
    const eventos = await prisma.eventoCalendario.findMany({
      where,
      orderBy: { inicio: 'asc' },
    });
    res.json(eventos);
  })
);

router.post(
  '/calendario',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(eventoSchema, req.body);
    const inicio = new Date(dados.inicio);
    const fim = new Date(dados.fim);
    if (fim < inicio) {
      throw new HttpError(400, 'A data de fim não pode ser antes da data de início');
    }
    if (dados.periodoLetivoId) {
      const periodo = await prisma.periodoLetivo.findUnique({
        where: { id: dados.periodoLetivoId },
        select: { id: true },
      });
      if (!periodo) {
        throw new HttpError(404, 'Período letivo não encontrado');
      }
    }

    const evento = await prisma.eventoCalendario.create({
      data: {
        titulo: dados.titulo,
        descricao: normalizarTexto(dados.descricao),
        inicio,
        fim,
        tipo: dados.tipo,
        periodoLetivoId: dados.periodoLetivoId ?? null,
      },
    });
    res.status(201).json(evento);
  })
);

router.put(
  '/calendario/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(eventoSchema.partial(), req.body);
    const existente = await prisma.eventoCalendario.findUnique({ where: { id } });
    if (!existente) {
      throw new HttpError(404, 'Evento não encontrado');
    }

    const inicio = dados.inicio !== undefined ? new Date(dados.inicio) : existente.inicio;
    const fim = dados.fim !== undefined ? new Date(dados.fim) : existente.fim;
    if (fim < inicio) {
      throw new HttpError(400, 'A data de fim não pode ser antes da data de início');
    }
    if (dados.periodoLetivoId) {
      const periodo = await prisma.periodoLetivo.findUnique({
        where: { id: dados.periodoLetivoId },
        select: { id: true },
      });
      if (!periodo) {
        throw new HttpError(404, 'Período letivo não encontrado');
      }
    }

    const evento = await prisma.eventoCalendario.update({
      where: { id },
      data: {
        titulo: dados.titulo,
        descricao: dados.descricao !== undefined ? normalizarTexto(dados.descricao) : undefined,
        inicio,
        fim,
        tipo: dados.tipo,
        periodoLetivoId: dados.periodoLetivoId,
      },
    });
    res.json(evento);
  })
);

router.delete(
  '/calendario/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const existente = await prisma.eventoCalendario.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      throw new HttpError(404, 'Evento não encontrado');
    }
    await prisma.eventoCalendario.delete({ where: { id } });
    res.status(204).end();
  })
);

export default router;
