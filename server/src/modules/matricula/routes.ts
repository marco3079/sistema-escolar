import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';

const router = Router();

// ---------- Inclusões (formatos MatriculaDTO e InscricaoDTO) ----------

const incluirMatricula = {
  aluno: { select: { id: true, ra: true, usuario: { select: { nome: true } } } },
  curso: { select: { id: true, nome: true, nivel: true, regime: true } },
  periodoIngresso: { select: { id: true, nome: true } },
} satisfies Prisma.MatriculaInclude;

const incluirInscricao = {
  turma: {
    select: {
      id: true,
      codigo: true,
      grupo: true,
      disciplina: { select: { id: true, nome: true, codigo: true, creditos: true, cargaHoraria: true } },
      periodoLetivo: { select: { id: true, nome: true } },
      professor: { select: { usuario: { select: { nome: true } } } },
    },
  },
} satisfies Prisma.InscricaoInclude;

// Formato TurmaDTO (contrato 5.3), usado nas turmas disponíveis.
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

type SituacaoTurma = 'DISPONIVEL' | 'JA_INSCRITO' | 'JA_APROVADO' | 'PRE_REQUISITO_PENDENTE' | 'SEM_VAGA';

type TurmaComSituacao = Prisma.TurmaGetPayload<{ include: typeof incluirTurma }> & {
  situacao: SituacaoTurma;
  pendentes: string[];
};

const STATUS_MATRICULA = ['ATIVA', 'TRANCADA', 'CONCLUIDA', 'CANCELADA'] as const;

// ---------- Auxiliares ----------

const SEM_PERMISSAO = 'Sem permissão';

// ALUNO passa só se for dono da matrícula. PROFESSOR passa só se `podeProfessor` (rotas de leitura marcadas com P).
// ADMIN e SECRETARIA passam sempre.
function conferirDono(
  req: Request,
  matricula: { alunoId: number },
  podeProfessor = false
): void {
  const { perfil, alunoId } = req.usuario;
  if (perfil === 'ADMIN' || perfil === 'SECRETARIA') return;
  if (perfil === 'ALUNO') {
    if (alunoId !== null && matricula.alunoId === alunoId) return;
    throw new HttpError(403, SEM_PERMISSAO);
  }
  if (perfil === 'PROFESSOR' && podeProfessor) return;
  throw new HttpError(403, SEM_PERMISSAO);
}

// Lê um query param inteiro opcional. Ausente ou vazio devolve undefined.
function queryInt(valor: unknown, nome: string): number | undefined {
  if (valor === undefined || valor === '') return undefined;
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) {
    throw new HttpError(400, `Parâmetro ${nome} inválido`);
  }
  const n = Number(valor);
  if (!Number.isSafeInteger(n)) throw new HttpError(400, `Parâmetro ${nome} inválido`);
  return n;
}

function queryStatus(valor: unknown): (typeof STATUS_MATRICULA)[number] | undefined {
  if (valor === undefined || valor === '') return undefined;
  const achado = STATUS_MATRICULA.find((s) => s === valor);
  if (!achado) throw new HttpError(400, 'Parâmetro status inválido');
  return achado;
}

function queryObrigatoriaInt(valor: unknown, nome: string): number {
  const n = queryInt(valor, nome);
  if (n === undefined) throw new HttpError(400, `Parâmetro ${nome} obrigatório`);
  return n;
}

const mensagemSituacao: Record<Exclude<SituacaoTurma, 'DISPONIVEL'>, (t: TurmaComSituacao) => string> = {
  JA_INSCRITO: () => 'Já inscrito nesta disciplina neste período',
  JA_APROVADO: () => 'Disciplina já aprovada',
  PRE_REQUISITO_PENDENTE: (t) => `Pré-requisito pendente: ${t.pendentes.join(', ')}`,
  SEM_VAGA: () => 'Turma sem vagas',
};

// Turmas do período cujas disciplinas são do curso da matrícula, cada uma com situacao e pendentes.
// Ordem de regras: JA_INSCRITO, JA_APROVADO, PRE_REQUISITO_PENDENTE, SEM_VAGA, senão DISPONIVEL.
async function situacoesDasTurmas(
  matriculaId: number,
  periodoLetivoId: number
): Promise<TurmaComSituacao[]> {
  const matricula = await prisma.matricula.findUnique({
    where: { id: matriculaId },
    select: { cursoId: true },
  });
  if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');

  const turmas = await prisma.turma.findMany({
    where: { periodoLetivoId, disciplina: { cursoId: matricula.cursoId } },
    include: incluirTurma,
    orderBy: [{ disciplina: { nome: 'asc' } }, { codigo: 'asc' }],
  });

  // Todas as inscrições da matrícula (todos os períodos): base de aprovação e de "já inscrito".
  const inscricoes = await prisma.inscricao.findMany({
    where: { matriculaId },
    select: { status: true, turma: { select: { disciplinaId: true, periodoLetivoId: true } } },
  });
  const aprovadas = new Set<number>();
  const cursandoNoPeriodo = new Set<number>();
  for (const i of inscricoes) {
    if (i.status === 'APROVADO') aprovadas.add(i.turma.disciplinaId);
    if (i.status === 'CURSANDO' && i.turma.periodoLetivoId === periodoLetivoId) {
      cursandoNoPeriodo.add(i.turma.disciplinaId);
    }
  }

  // Pré-requisitos das disciplinas do curso (sem consulta dentro de laço).
  const disciplinasDoCurso = await prisma.disciplina.findMany({
    where: { cursoId: matricula.cursoId },
    select: { id: true, preRequisitos: { select: { id: true, nome: true } } },
  });
  const preRequisitosDe = new Map<number, { id: number; nome: string }[]>();
  for (const d of disciplinasDoCurso) preRequisitosDe.set(d.id, d.preRequisitos);

  // Inscrições não trancadas por turma (para vagas).
  const idsTurmas = turmas.map((t) => t.id);
  const contagens = await prisma.inscricao.groupBy({
    by: ['turmaId'],
    where: { turmaId: { in: idsTurmas }, status: { not: 'TRANCADO' } },
    _count: { _all: true },
  });
  const ocupadas = new Map<number, number>();
  for (const c of contagens) ocupadas.set(c.turmaId, c._count._all);

  return turmas.map((t) => {
    const pendentes = (preRequisitosDe.get(t.disciplinaId) ?? [])
      .filter((p) => !aprovadas.has(p.id))
      .map((p) => p.nome);

    let situacao: SituacaoTurma = 'DISPONIVEL';
    if (cursandoNoPeriodo.has(t.disciplinaId)) situacao = 'JA_INSCRITO';
    else if (aprovadas.has(t.disciplinaId)) situacao = 'JA_APROVADO';
    else if (pendentes.length > 0) situacao = 'PRE_REQUISITO_PENDENTE';
    else if ((ocupadas.get(t.id) ?? 0) >= t.vagas) situacao = 'SEM_VAGA';

    return { ...t, situacao, pendentes };
  });
}

// ---------- Rotas ----------

// Declarada antes de /matriculas/:id
router.get(
  '/matriculas/minhas',
  permitir('ALUNO'),
  asyncHandler(async (req, res) => {
    const alunoId = req.usuario.alunoId;
    if (alunoId === null) throw new HttpError(403, SEM_PERMISSAO);
    const lista = await prisma.matricula.findMany({
      where: { alunoId },
      include: incluirMatricula,
      orderBy: { periodoIngresso: { inicio: 'desc' } },
    });
    res.json(lista);
  })
);

router.get(
  '/matriculas',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const alunoId = queryInt(req.query.alunoId, 'alunoId');
    const cursoId = queryInt(req.query.cursoId, 'cursoId');
    const status = queryStatus(req.query.status);
    const lista = await prisma.matricula.findMany({
      where: {
        ...(alunoId !== undefined ? { alunoId } : {}),
        ...(cursoId !== undefined ? { cursoId } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      include: incluirMatricula,
      orderBy: { aluno: { usuario: { nome: 'asc' } } },
    });
    res.json(lista);
  })
);

router.get(
  '/matriculas/:id',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const matricula = await prisma.matricula.findUnique({
      where: { id },
      include: {
        ...incluirMatricula,
        inscricoes: { include: incluirInscricao, orderBy: { id: 'asc' } },
      },
    });
    if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');
    conferirDono(req, matricula, true);
    res.json(matricula);
  })
);

const criarMatriculaSchema = z.object({
  alunoId: z.number().int(),
  cursoId: z.number().int(),
  periodoIngressoId: z.number().int(),
  serieAtual: z.number().int().min(1).optional(),
});

router.post(
  '/matriculas',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(criarMatriculaSchema, req.body);

    const [aluno, curso, periodo] = await Promise.all([
      prisma.aluno.findUnique({ where: { id: dados.alunoId }, select: { id: true } }),
      prisma.curso.findUnique({ where: { id: dados.cursoId }, select: { id: true } }),
      prisma.periodoLetivo.findUnique({ where: { id: dados.periodoIngressoId }, select: { id: true } }),
    ]);
    if (!aluno) throw new HttpError(404, 'Aluno não encontrado');
    if (!curso) throw new HttpError(404, 'Curso não encontrado');
    if (!periodo) throw new HttpError(404, 'Período letivo não encontrado');

    const existente = await prisma.matricula.findUnique({
      where: { alunoId_cursoId: { alunoId: dados.alunoId, cursoId: dados.cursoId } },
      select: { id: true },
    });
    if (existente) throw new HttpError(409, 'Aluno já matriculado neste curso');

    const criada = await prisma.matricula.create({
      data: {
        alunoId: dados.alunoId,
        cursoId: dados.cursoId,
        periodoIngressoId: dados.periodoIngressoId,
        ...(dados.serieAtual !== undefined ? { serieAtual: dados.serieAtual } : {}),
      },
      include: incluirMatricula,
    });
    res.status(201).json(criada);
  })
);

const atualizarMatriculaSchema = z.object({
  status: z.enum(STATUS_MATRICULA).optional(),
  serieAtual: z.number().int().min(1).optional(),
});

router.put(
  '/matriculas/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(atualizarMatriculaSchema, req.body);
    const atualizada = await prisma.matricula.update({
      where: { id },
      data: {
        ...(dados.status !== undefined ? { status: dados.status } : {}),
        ...(dados.serieAtual !== undefined ? { serieAtual: dados.serieAtual } : {}),
      },
      include: incluirMatricula,
    });
    res.json(atualizada);
  })
);

const enturmarSchema = z.object({
  periodoLetivoId: z.number().int(),
  grupo: z.string().min(1),
});

router.post(
  '/matriculas/:id/enturmar',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(enturmarSchema, req.body);

    const matricula = await prisma.matricula.findUnique({
      where: { id },
      select: { id: true, cursoId: true, status: true },
    });
    if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');
    if (matricula.status !== 'ATIVA') throw new HttpError(409, 'Matrícula não está ativa');

    const turmas = await prisma.turma.findMany({
      where: {
        periodoLetivoId: dados.periodoLetivoId,
        grupo: dados.grupo,
        disciplina: { cursoId: matricula.cursoId },
      },
      select: { id: true },
    });

    const resultado = await prisma.inscricao.createMany({
      data: turmas.map((t) => ({ matriculaId: id, turmaId: t.id })),
      skipDuplicates: true,
    });
    res.json({ inscritas: resultado.count });
  })
);

router.get(
  '/matriculas/:id/turmas-disponiveis',
  permitir('ADMIN', 'SECRETARIA', 'ALUNO'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const periodoLetivoId = queryObrigatoriaInt(req.query.periodoLetivoId, 'periodoLetivoId');
    const matricula = await prisma.matricula.findUnique({
      where: { id },
      select: { id: true, alunoId: true },
    });
    if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');
    conferirDono(req, matricula);
    res.json(await situacoesDasTurmas(id, periodoLetivoId));
  })
);

const inscreverSchema = z.object({
  matriculaId: z.number().int(),
  turmaId: z.number().int(),
});

router.post(
  '/inscricoes',
  permitir('ADMIN', 'SECRETARIA', 'ALUNO'),
  asyncHandler(async (req, res) => {
    const dados = validar(inscreverSchema, req.body);

    const matricula = await prisma.matricula.findUnique({
      where: { id: dados.matriculaId },
      select: { id: true, alunoId: true, status: true },
    });
    if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');
    conferirDono(req, matricula);
    if (matricula.status !== 'ATIVA') throw new HttpError(409, 'Matrícula não está ativa');

    const turma = await prisma.turma.findUnique({
      where: { id: dados.turmaId },
      select: { id: true, periodoLetivoId: true },
    });
    if (!turma) throw new HttpError(404, 'Turma não encontrada');

    const lista = await situacoesDasTurmas(matricula.id, turma.periodoLetivoId);
    const escolhida = lista.find((t) => t.id === turma.id);
    if (!escolhida) throw new HttpError(404, 'Turma não encontrada para esta matrícula');
    if (escolhida.situacao !== 'DISPONIVEL') {
      throw new HttpError(409, mensagemSituacao[escolhida.situacao](escolhida));
    }

    const criada = await prisma.inscricao.create({
      data: { matriculaId: matricula.id, turmaId: turma.id },
      include: incluirInscricao,
    });
    res.status(201).json(criada);
  })
);

router.delete(
  '/inscricoes/:id',
  permitir('ADMIN', 'SECRETARIA', 'ALUNO'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const inscricao = await prisma.inscricao.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        matricula: { select: { alunoId: true } },
        _count: { select: { notas: true, presencas: true } },
      },
    });
    if (!inscricao) throw new HttpError(404, 'Inscrição não encontrada');
    conferirDono(req, inscricao.matricula);
    if (inscricao.status !== 'CURSANDO') {
      throw new HttpError(409, 'Só é possível cancelar inscrição em curso');
    }

    if (inscricao._count.notas === 0 && inscricao._count.presencas === 0) {
      await prisma.inscricao.delete({ where: { id } });
    } else {
      await prisma.inscricao.update({ where: { id }, data: { status: 'TRANCADO' } });
    }
    res.status(204).end();
  })
);

export default router;
