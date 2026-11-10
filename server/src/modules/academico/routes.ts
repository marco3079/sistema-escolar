import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';

const router = Router();

const gestao = permitir('ADMIN', 'SECRETARIA');

const NIVEIS = [
  'FUNDAMENTAL_1',
  'FUNDAMENTAL_2',
  'MEDIO',
  'TECNICO',
  'GRADUACAO',
  'ESPECIALIZACAO',
  'MESTRADO',
  'DOUTORADO',
] as const;
const REGIMES = ['SERIADO', 'CREDITOS'] as const;
const TIPOS_PERIODO = ['ANUAL', 'SEMESTRAL'] as const;

// ---------- Auxiliares ----------

interface Mensagens {
  conflito?: string;
  naoEncontrado?: string;
  vinculo?: { status: number; mensagem: string };
}

// Traduz erros conhecidos do Prisma para respostas HTTP. Qualquer outro erro é repassado.
function traduzirErro(e: unknown, msg: Mensagens): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw new HttpError(409, msg.conflito ?? 'Já existe um registro com esses dados');
    }
    if (e.code === 'P2003') {
      const vinculo = msg.vinculo ?? { status: 400, mensagem: 'Registro relacionado não existe' };
      throw new HttpError(vinculo.status, vinculo.mensagem);
    }
    if (e.code === 'P2025') {
      throw new HttpError(404, msg.naoEncontrado ?? 'Registro não encontrado');
    }
  }
  throw e;
}

async function gravar<T>(operacao: () => Promise<T>, msg: Mensagens = {}): Promise<T> {
  try {
    return await operacao();
  } catch (e) {
    return traduzirErro(e, msg);
  }
}

// Texto de query: vazio ou ausente vira undefined.
function texto(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim();
  return limpo === '' ? undefined : limpo;
}

// Número inteiro de query: vazio ou ausente vira undefined; inválido devolve 400.
function numero(valor: unknown, nome: string): number | undefined {
  const limpo = texto(valor);
  if (limpo === undefined) return undefined;
  const n = Number(limpo);
  if (!Number.isInteger(n)) {
    throw new HttpError(400, `Parâmetro ${nome} inválido`);
  }
  return n;
}

// Booleano de query ('true' ou 'false'); vazio ou ausente vira undefined.
function booleano(valor: unknown, nome: string): boolean | undefined {
  const limpo = texto(valor);
  if (limpo === undefined) return undefined;
  if (limpo === 'true') return true;
  if (limpo === 'false') return false;
  throw new HttpError(400, `Parâmetro ${nome} inválido`);
}

// Campo de texto opcional de formulário: vazio vira null.
const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullish();

// Data no formato AAAA-MM-DD
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD');

function validarIntervalo(inicio: Date, fim: Date): void {
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw new HttpError(400, 'Data inválida');
  }
  if (fim.getTime() <= inicio.getTime()) {
    throw new HttpError(400, 'A data de fim precisa ser depois da data de início');
  }
}

// Confere os pré-requisitos: sem duplicatas, sem auto-referência e todos existentes.
async function validarPreRequisitos(ids: number[], disciplinaId?: number): Promise<number[]> {
  const unicos = [...new Set(ids)];
  if (disciplinaId !== undefined && unicos.includes(disciplinaId)) {
    throw new HttpError(400, 'Uma disciplina não pode ser pré-requisito dela mesma');
  }
  if (unicos.length > 0) {
    const encontradas = await prisma.disciplina.count({ where: { id: { in: unicos } } });
    if (encontradas !== unicos.length) {
      throw new HttpError(400, 'Pré-requisito inexistente');
    }
  }
  return unicos;
}

// Include padrão do TurmaDTO (formato contrato 5.3)
const incluirTurma = {
  disciplina: {
    select: {
      id: true,
      nome: true,
      codigo: true,
      creditos: true,
      cursoId: true,
      curso: { select: { id: true, nome: true, nivel: true, regime: true } },
    },
  },
  professor: { select: { id: true, usuario: { select: { nome: true } } } },
  periodoLetivo: { select: { id: true, nome: true } },
  _count: { select: { inscricoes: true } },
} satisfies Prisma.TurmaInclude;

const incluirPreRequisitos = {
  preRequisitos: { select: { id: true, nome: true, codigo: true } },
} satisfies Prisma.DisciplinaInclude;

// ---------- Cursos ----------

const cursoSchema = z.object({
  nome: z.string().trim().min(1),
  codigo: z.string().trim().min(1),
  nivel: z.enum(NIVEIS),
  regime: z.enum(REGIMES),
  duracaoPeriodos: z.number().int().min(1),
  cargaHorariaTotal: z.number().int().min(0),
  mensalidade: z.number().min(0),
});

const cursoAtualizacao = cursoSchema.extend({ ativo: z.boolean() }).partial();

router.get(
  '/cursos',
  asyncHandler(async (req, res) => {
    const nivelBruto = texto(req.query.nivel);
    const nivel = nivelBruto === undefined ? undefined : validar(z.enum(NIVEIS), nivelBruto);
    const ativo = booleano(req.query.ativo, 'ativo');
    res.json(
      await prisma.curso.findMany({
        where: { nivel, ativo },
        orderBy: { nome: 'asc' },
      })
    );
  })
);

router.get(
  '/cursos/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const curso = await prisma.curso.findUnique({
      where: { id },
      include: {
        disciplinas: {
          orderBy: [{ periodoSugerido: 'asc' }, { nome: 'asc' }],
          include: incluirPreRequisitos,
        },
      },
    });
    if (!curso) {
      throw new HttpError(404, 'Curso não encontrado');
    }
    res.json(curso);
  })
);

router.post(
  '/cursos',
  gestao,
  asyncHandler(async (req, res) => {
    const dados = validar(cursoSchema, req.body);
    const curso = await gravar(() => prisma.curso.create({ data: dados }), {
      conflito: 'Já existe um curso com esse código',
    });
    res.status(201).json(curso);
  })
);

router.put(
  '/cursos/:id',
  gestao,
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(cursoAtualizacao, req.body);
    const curso = await gravar(() => prisma.curso.update({ where: { id }, data: dados }), {
      conflito: 'Já existe um curso com esse código',
      naoEncontrado: 'Curso não encontrado',
    });
    res.json(curso);
  })
);

router.delete(
  '/cursos/:id',
  gestao,
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    await gravar(() => prisma.curso.update({ where: { id }, data: { ativo: false } }), {
      naoEncontrado: 'Curso não encontrado',
    });
    res.status(204).end();
  })
);

// ---------- Disciplinas ----------

const disciplinaSchema = z.object({
  cursoId: z.number().int(),
  nome: z.string().trim().min(1),
  codigo: z.string().trim().min(1),
  cargaHoraria: z.number().int().min(0),
  creditos: z.number().int().min(0),
  periodoSugerido: z.number().int().min(1),
  obrigatoria: z.boolean(),
  preRequisitoIds: z.array(z.number().int()),
});

const disciplinaAtualizacao = disciplinaSchema.partial();

router.get(
  '/disciplinas',
  asyncHandler(async (req, res) => {
    const cursoId = numero(req.query.cursoId, 'cursoId');
    res.json(
      await prisma.disciplina.findMany({
        where: { cursoId },
        orderBy: [{ periodoSugerido: 'asc' }, { nome: 'asc' }],
        include: incluirPreRequisitos,
      })
    );
  })
);

router.post(
  '/disciplinas',
  gestao,
  asyncHandler(async (req, res) => {
    const { preRequisitoIds, ...campos } = validar(disciplinaSchema, req.body);
    const ids = await validarPreRequisitos(preRequisitoIds);
    const disciplina = await gravar(
      () =>
        prisma.disciplina.create({
          data: {
            ...campos,
            preRequisitos: { connect: ids.map((id) => ({ id })) },
          },
          include: incluirPreRequisitos,
        }),
      {
        conflito: 'Já existe uma disciplina com esse código',
        vinculo: { status: 400, mensagem: 'Curso informado não existe' },
      }
    );
    res.status(201).json(disciplina);
  })
);

router.put(
  '/disciplinas/:id',
  gestao,
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const { preRequisitoIds, ...campos } = validar(disciplinaAtualizacao, req.body);
    const ids =
      preRequisitoIds === undefined ? undefined : await validarPreRequisitos(preRequisitoIds, id);
    const disciplina = await gravar(
      () =>
        prisma.disciplina.update({
          where: { id },
          data: {
            ...campos,
            ...(ids !== undefined ? { preRequisitos: { set: ids.map((x) => ({ id: x })) } } : {}),
          },
          include: incluirPreRequisitos,
        }),
      {
        conflito: 'Já existe uma disciplina com esse código',
        naoEncontrado: 'Disciplina não encontrada',
        vinculo: { status: 400, mensagem: 'Curso informado não existe' },
      }
    );
    res.json(disciplina);
  })
);

router.delete(
  '/disciplinas/:id',
  gestao,
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const turmas = await prisma.turma.count({ where: { disciplinaId: id } });
    if (turmas > 0) {
      throw new HttpError(409, 'Disciplina possui turmas e não pode ser excluída');
    }
    await gravar(() => prisma.disciplina.delete({ where: { id } }), {
      naoEncontrado: 'Disciplina não encontrada',
    });
    res.status(204).end();
  })
);

// ---------- Períodos letivos ----------

const periodoSchema = z.object({
  nome: z.string().trim().min(1),
  ano: z.number().int(),
  tipo: z.enum(TIPOS_PERIODO),
  inicio: dataIso,
  fim: dataIso,
});

const periodoAtualizacao = periodoSchema.extend({ ativo: z.boolean() }).partial();

router.get(
  '/periodos-letivos',
  asyncHandler(async (req, res) => {
    const ativo = booleano(req.query.ativo, 'ativo');
    res.json(
      await prisma.periodoLetivo.findMany({
        where: { ativo },
        orderBy: { inicio: 'desc' },
      })
    );
  })
);

router.post(
  '/periodos-letivos',
  gestao,
  asyncHandler(async (req, res) => {
    const dados = validar(periodoSchema, req.body);
    const inicio = new Date(dados.inicio);
    const fim = new Date(dados.fim);
    validarIntervalo(inicio, fim);
    const periodo = await gravar(
      () => prisma.periodoLetivo.create({ data: { ...dados, inicio, fim } }),
      { conflito: 'Já existe um período letivo com esse nome' }
    );
    res.status(201).json(periodo);
  })
);

router.put(
  '/periodos-letivos/:id',
  gestao,
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(periodoAtualizacao, req.body);
    const atual = await prisma.periodoLetivo.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Período letivo não encontrado');
    }
    const inicio = dados.inicio !== undefined ? new Date(dados.inicio) : atual.inicio;
    const fim = dados.fim !== undefined ? new Date(dados.fim) : atual.fim;
    validarIntervalo(inicio, fim);
    const periodo = await gravar(
      () => prisma.periodoLetivo.update({ where: { id }, data: { ...dados, inicio, fim } }),
      {
        conflito: 'Já existe um período letivo com esse nome',
        naoEncontrado: 'Período letivo não encontrado',
      }
    );
    res.json(periodo);
  })
);

// ---------- Turmas ----------

const turmaSchema = z.object({
  codigo: z.string().trim().min(1),
  disciplinaId: z.number().int(),
  periodoLetivoId: z.number().int(),
  professorId: z.number().int(),
  grupo: textoOpcional,
  vagas: z.number().int().min(0),
  sala: textoOpcional,
});

const turmaAtualizacao = turmaSchema.partial();

// Declarada antes de /turmas/:id para não ser capturada pelo parâmetro.
router.get(
  '/turmas/minhas',
  permitir('PROFESSOR'),
  asyncHandler(async (req, res) => {
    const professorId = req.usuario.professorId;
    if (professorId === null) {
      res.json([]);
      return;
    }
    const periodoLetivoId = numero(req.query.periodoLetivoId, 'periodoLetivoId');
    res.json(
      await prisma.turma.findMany({
        where: { professorId, periodoLetivoId },
        include: incluirTurma,
        orderBy: { codigo: 'asc' },
      })
    );
  })
);

router.get(
  '/turmas',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const periodoLetivoId = numero(req.query.periodoLetivoId, 'periodoLetivoId');
    const cursoId = numero(req.query.cursoId, 'cursoId');
    const professorId = numero(req.query.professorId, 'professorId');
    const grupo = texto(req.query.grupo);
    res.json(
      await prisma.turma.findMany({
        where: {
          periodoLetivoId,
          professorId,
          grupo,
          disciplina: cursoId !== undefined ? { cursoId } : undefined,
        },
        include: incluirTurma,
        orderBy: { codigo: 'asc' },
      })
    );
  })
);

router.get(
  '/turmas/:id',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const turma = await prisma.turma.findUnique({ where: { id }, include: incluirTurma });
    if (!turma) {
      throw new HttpError(404, 'Turma não encontrada');
    }
    res.json(turma);
  })
);

router.post(
  '/turmas',
  gestao,
  asyncHandler(async (req, res) => {
    const dados = validar(turmaSchema, req.body);
    const turma = await gravar(
      () => prisma.turma.create({ data: dados, include: incluirTurma }),
      {
        conflito: 'Já existe uma turma com esse código neste período',
        vinculo: { status: 400, mensagem: 'Disciplina, período ou professor não existe' },
      }
    );
    res.status(201).json(turma);
  })
);

router.put(
  '/turmas/:id',
  gestao,
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(turmaAtualizacao, req.body);
    const turma = await gravar(
      () => prisma.turma.update({ where: { id }, data: dados, include: incluirTurma }),
      {
        conflito: 'Já existe uma turma com esse código neste período',
        naoEncontrado: 'Turma não encontrada',
        vinculo: { status: 400, mensagem: 'Disciplina, período ou professor não existe' },
      }
    );
    res.json(turma);
  })
);

router.delete(
  '/turmas/:id',
  gestao,
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const inscricoes = await prisma.inscricao.count({ where: { turmaId: id } });
    if (inscricoes > 0) {
      throw new HttpError(409, 'Turma possui inscrições e não pode ser excluída');
    }
    await gravar(() => prisma.turma.delete({ where: { id } }), {
      naoEncontrado: 'Turma não encontrada',
      vinculo: {
        status: 409,
        mensagem: 'Turma possui aulas, avaliações ou horários vinculados e não pode ser excluída',
      },
    });
    res.status(204).end();
  })
);

export default router;
