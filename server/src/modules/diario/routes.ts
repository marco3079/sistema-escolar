import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { calcularSituacao } from '../../lib/regras';
import { notificar } from '../../lib/notificacoes';
import { recalcularInscricoes, recalcularTurma } from './calculo';

const router = Router();

const SEM_PERMISSAO = 'Sem permissão';

const ROTULO_SITUACAO: Record<string, string> = {
  APROVADO: 'aprovado',
  REPROVADO_NOTA: 'reprovado por nota',
  REPROVADO_FALTA: 'reprovado por falta',
};

// TurmaDTO (contrato 5.3)
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
} as const;

// MatriculaDTO (contrato 5.4)
const incluirMatricula = {
  aluno: { select: { id: true, ra: true, usuario: { select: { nome: true } } } },
  curso: { select: { id: true, nome: true, nivel: true, regime: true } },
  periodoIngresso: { select: { id: true, nome: true } },
} as const;

// ---------- Esquemas de entrada ----------

const dataIso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida');

const avaliacaoSchema = z.object({
  nome: z.string().trim().min(1),
  peso: z.number().positive(),
  data: dataIso,
  notaMaxima: z.number().positive().optional(),
});

const avaliacaoAtualizarSchema = avaliacaoSchema.partial();

const notasSchema = z.object({
  notas: z.array(z.object({ inscricaoId: z.number().int(), valor: z.number() })),
});

const presencaSchema = z.object({ inscricaoId: z.number().int(), presente: z.boolean() });

const aulaSchema = z.object({
  data: dataIso,
  conteudo: z.string().nullable().optional(),
  presencas: z.array(presencaSchema),
});

// ---------- Auxiliares ----------

// Carrega a turma (TurmaDTO) e confere a permissão do usuário logado.
// ADMIN sempre passa; SECRETARIA só com leituraSecretaria; PROFESSOR só se for o professor da turma.
async function carregarTurmaDoProfessor(
  req: Request,
  turmaId: number,
  opcoes: { leituraSecretaria: boolean }
) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId }, include: incluirTurma });
  if (!turma) throw new HttpError(404, 'Turma não encontrada');
  const { perfil, professorId } = req.usuario;
  if (perfil === 'ADMIN') return turma;
  if (perfil === 'SECRETARIA' && opcoes.leituraSecretaria) return turma;
  if (perfil === 'PROFESSOR' && professorId !== null && turma.professorId === professorId) {
    return turma;
  }
  throw new HttpError(403, SEM_PERMISSAO);
}

async function carregarAvaliacao(req: Request, avaliacaoId: number) {
  const avaliacao = await prisma.avaliacao.findUnique({ where: { id: avaliacaoId } });
  if (!avaliacao) throw new HttpError(404, 'Avaliação não encontrada');
  await carregarTurmaDoProfessor(req, avaliacao.turmaId, { leituraSecretaria: false });
  return avaliacao;
}

// Confere que os ids são inscrições da turma e sem repetição.
async function validarInscricoesDaTurma(turmaId: number, ids: number[]): Promise<void> {
  const unicos = [...new Set(ids)];
  if (unicos.length !== ids.length) {
    throw new HttpError(400, 'Inscrição repetida');
  }
  if (unicos.length === 0) return;
  const total = await prisma.inscricao.count({ where: { id: { in: unicos }, turmaId } });
  if (total !== unicos.length) {
    throw new HttpError(400, 'Inscrição não pertence a esta turma');
  }
}

// Lista de inscrições do diário: sem TRANCADO, por nome do aluno.
async function inscricoesDoDiario(turmaId: number) {
  const inscricoes = await prisma.inscricao.findMany({
    where: { turmaId, status: { not: 'TRANCADO' } },
    select: {
      id: true,
      status: true,
      notaFinal: true,
      frequencia: true,
      matricula: {
        select: { aluno: { select: { ra: true, usuario: { select: { nome: true } } } } },
      },
    },
  });
  return inscricoes
    .map((i) => ({
      id: i.id,
      status: i.status,
      notaFinal: i.notaFinal,
      frequencia: i.frequencia,
      aluno: { ra: i.matricula.aluno.ra, nome: i.matricula.aluno.usuario.nome },
    }))
    .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
}

function paraAulaResposta(aula: {
  id: number;
  turmaId: number;
  data: Date;
  conteudo: string | null;
  presencas: { inscricaoId: number; presente: boolean }[];
}) {
  return {
    id: aula.id,
    turmaId: aula.turmaId,
    data: aula.data,
    conteudo: aula.conteudo,
    presencas: aula.presencas.map((p) => ({ inscricaoId: p.inscricaoId, presente: p.presente })),
  };
}

function paraMatriculaResposta(matricula: {
  id: number;
  alunoId: number;
  cursoId: number;
  periodoIngressoId: number;
  dataMatricula: Date;
  status: string;
  serieAtual: number;
  aluno: { id: number; ra: string; usuario: { nome: string } };
  curso: { id: number; nome: string; nivel: string; regime: string };
  periodoIngresso: { id: number; nome: string };
}) {
  return {
    id: matricula.id,
    alunoId: matricula.alunoId,
    cursoId: matricula.cursoId,
    periodoIngressoId: matricula.periodoIngressoId,
    dataMatricula: matricula.dataMatricula,
    status: matricula.status,
    serieAtual: matricula.serieAtual,
    aluno: {
      id: matricula.aluno.id,
      ra: matricula.aluno.ra,
      usuario: { nome: matricula.aluno.usuario.nome },
    },
    curso: matricula.curso,
    periodoIngresso: matricula.periodoIngresso,
  };
}

// Matrícula do aluno logado: ?matriculaId= (precisa ser dele) ou a primeira ATIVA.
async function matriculaDoAlunoLogado(req: Request): Promise<number> {
  const alunoId = req.usuario.alunoId;
  if (alunoId === null) throw new HttpError(403, SEM_PERMISSAO);

  const bruto = req.query.matriculaId;
  if (bruto !== undefined) {
    if (typeof bruto !== 'string' || !/^\d+$/.test(bruto)) {
      throw new HttpError(400, 'Parâmetro matriculaId inválido');
    }
    const matriculaId = Number(bruto);
    const matricula = await prisma.matricula.findUnique({
      where: { id: matriculaId },
      select: { alunoId: true },
    });
    if (!matricula || matricula.alunoId !== alunoId) throw new HttpError(403, SEM_PERMISSAO);
    return matriculaId;
  }

  const primeira = await prisma.matricula.findFirst({
    where: { alunoId, status: 'ATIVA' },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!primeira) throw new HttpError(404, 'Nenhuma matrícula encontrada');
  return primeira.id;
}

// BoletimDTO (contrato 5.5)
async function montarBoletim(matriculaId: number) {
  const matricula = await prisma.matricula.findUnique({
    where: { id: matriculaId },
    include: incluirMatricula,
  });
  if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');

  const inscricoes = await prisma.inscricao.findMany({
    where: { matriculaId },
    include: {
      notas: true,
      turma: {
        include: {
          disciplina: { select: { nome: true, codigo: true } },
          periodoLetivo: { select: { id: true, nome: true, inicio: true } },
          professor: { select: { usuario: { select: { nome: true } } } },
          avaliacoes: { orderBy: { data: 'asc' } },
        },
      },
    },
  });

  const grupos = new Map<
    number,
    {
      periodo: { id: number; nome: string };
      inicio: Date;
      itens: {
        inscricaoId: number;
        disciplina: string;
        codigo: string;
        turma: string;
        professor: string;
        avaliacoes: { nome: string; peso: number; notaMaxima: number; valor: number | null }[];
        notaFinal: number | null;
        frequencia: number | null;
        status: string;
      }[];
    }
  >();

  for (const i of inscricoes) {
    const t = i.turma;
    const notaPorAvaliacao = new Map<number, number>();
    for (const n of i.notas) notaPorAvaliacao.set(n.avaliacaoId, n.valor);

    const item = {
      inscricaoId: i.id,
      disciplina: t.disciplina.nome,
      codigo: t.disciplina.codigo,
      turma: t.codigo,
      professor: t.professor.usuario.nome,
      avaliacoes: t.avaliacoes.map((a) => ({
        nome: a.nome,
        peso: a.peso,
        notaMaxima: a.notaMaxima,
        valor: notaPorAvaliacao.get(a.id) ?? null,
      })),
      notaFinal: i.notaFinal,
      frequencia: i.frequencia,
      status: i.status,
    };

    let grupo = grupos.get(t.periodoLetivo.id);
    if (!grupo) {
      grupo = {
        periodo: { id: t.periodoLetivo.id, nome: t.periodoLetivo.nome },
        inicio: t.periodoLetivo.inicio,
        itens: [],
      };
      grupos.set(t.periodoLetivo.id, grupo);
    }
    grupo.itens.push(item);
  }

  const periodos = Array.from(grupos.values())
    .sort((a, b) => b.inicio.getTime() - a.inicio.getTime())
    .map((g) => ({
      periodo: g.periodo,
      itens: g.itens.sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR')),
    }));

  return { matricula: paraMatriculaResposta(matricula), periodos };
}

// HistoricoDTO (contrato 5.5)
async function montarHistorico(matriculaId: number) {
  const matricula = await prisma.matricula.findUnique({
    where: { id: matriculaId },
    include: incluirMatricula,
  });
  if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');

  const inscricoes = await prisma.inscricao.findMany({
    where: { matriculaId, status: { not: 'TRANCADO' } },
    include: {
      turma: {
        include: {
          disciplina: true,
          periodoLetivo: { select: { nome: true, inicio: true } },
        },
      },
    },
  });

  inscricoes.sort((a, b) => {
    const porPeriodo = b.turma.periodoLetivo.inicio.getTime() - a.turma.periodoLetivo.inicio.getTime();
    if (porPeriodo !== 0) return porPeriodo;
    return a.turma.disciplina.codigo.localeCompare(b.turma.disciplina.codigo, 'pt-BR');
  });

  const itens = inscricoes.map((i) => ({
    periodo: i.turma.periodoLetivo.nome,
    codigo: i.turma.disciplina.codigo,
    disciplina: i.turma.disciplina.nome,
    cargaHoraria: i.turma.disciplina.cargaHoraria,
    creditos: i.turma.disciplina.creditos,
    notaFinal: i.notaFinal,
    frequencia: i.frequencia,
    status: i.status,
  }));

  let creditosConcluidos = 0;
  let cargaHorariaConcluida = 0;
  let somaPonderada = 0;
  let somaCargaHoraria = 0;
  for (const i of inscricoes) {
    const d = i.turma.disciplina;
    if (i.status === 'APROVADO') {
      creditosConcluidos += d.creditos;
      cargaHorariaConcluida += d.cargaHoraria;
    }
    const avaliada =
      i.status === 'APROVADO' || i.status === 'REPROVADO_NOTA' || i.status === 'REPROVADO_FALTA';
    if (avaliada && i.notaFinal !== null) {
      somaPonderada += i.notaFinal * d.cargaHoraria;
      somaCargaHoraria += d.cargaHoraria;
    }
  }
  const coeficiente =
    somaCargaHoraria > 0 ? Math.round((somaPonderada / somaCargaHoraria) * 100) / 100 : null;

  return {
    matricula: paraMatriculaResposta(matricula),
    itens,
    resumo: { creditosConcluidos, cargaHorariaConcluida, coeficiente },
  };
}

// Data de hoje (aaaa-mm-dd, relógio do servidor), para a chave de aviso de nota.
function dataDeHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Aviso no sino ao aluno de cada nota lançada ou alterada (uma por dia e por avaliação). Em segundo plano.
function avisarNotas(avaliacao: { id: number; turmaId: number }, inscricaoIds: number[]): void {
  void (async () => {
    const [turma, inscricoes] = await Promise.all([
      prisma.turma.findUnique({ where: { id: avaliacao.turmaId }, select: { disciplina: { select: { nome: true } } } }),
      prisma.inscricao.findMany({
        where: { id: { in: inscricaoIds } },
        select: { matricula: { select: { aluno: { select: { id: true, usuarioId: true } } } } },
      }),
    ]);
    if (!turma) {
      return;
    }
    const hoje = dataDeHoje();
    for (const i of inscricoes) {
      const aluno = i.matricula.aluno;
      notificar([aluno.usuarioId], {
        tipo: 'NOTA',
        titulo: `Nota lançada em ${turma.disciplina.nome}`,
        link: '/boletim',
        chave: `nota:${avaliacao.id}:${aluno.id}:${hoje}`,
      });
    }
  })().catch(() => undefined);
}

// Aviso no sino ao aluno com o resultado final do fechamento do diário.
function avisarResultados(
  disciplina: string,
  itens: { situacao: string; matricula: { aluno: { usuarioId: number } } }[]
): void {
  for (const i of itens) {
    notificar([i.matricula.aluno.usuarioId], {
      tipo: 'NOTA',
      titulo: `Resultado final em ${disciplina}: ${ROTULO_SITUACAO[i.situacao] ?? i.situacao}`,
      link: '/boletim',
    });
  }
}

// ---------- Diário da turma ----------

router.get(
  '/turmas/:id/diario',
  asyncHandler(async (req, res) => {
    const turma = await carregarTurmaDoProfessor(req, idParam(req), { leituraSecretaria: true });
    const [inscricoes, avaliacoes, notas, aulas] = await Promise.all([
      inscricoesDoDiario(turma.id),
      prisma.avaliacao.findMany({
        where: { turmaId: turma.id },
        select: { id: true, nome: true, peso: true, data: true, notaMaxima: true },
        orderBy: { data: 'asc' },
      }),
      prisma.nota.findMany({
        where: { avaliacao: { turmaId: turma.id } },
        select: { avaliacaoId: true, inscricaoId: true, valor: true },
      }),
      prisma.aula.findMany({
        where: { turmaId: turma.id },
        select: { id: true, data: true, conteudo: true, presencas: { select: { presente: true } } },
        orderBy: { data: 'asc' },
      }),
    ]);
    res.json({
      turma,
      inscricoes,
      avaliacoes,
      notas,
      aulas: aulas.map((a) => ({
        id: a.id,
        data: a.data,
        conteudo: a.conteudo,
        presentes: a.presencas.filter((p) => p.presente).length,
        total: a.presencas.length,
      })),
    });
  })
);

router.post(
  '/turmas/:id/fechar',
  asyncHandler(async (req, res) => {
    const turma = await carregarTurmaDoProfessor(req, idParam(req), { leituraSecretaria: false });
    await recalcularTurma(turma.id);

    const nivel = turma.disciplina.curso.nivel;
    const cursando = await prisma.inscricao.findMany({
      where: { turmaId: turma.id, status: 'CURSANDO' },
      select: {
        id: true,
        notaFinal: true,
        frequencia: true,
        matricula: { select: { aluno: { select: { usuarioId: true } } } },
      },
    });
    const situacoes = cursando.map((i) => ({
      ...i,
      situacao: calcularSituacao(nivel, i.notaFinal ?? 0, i.frequencia ?? 100),
    }));
    await prisma.$transaction(
      situacoes.map((i) =>
        prisma.inscricao.update({
          where: { id: i.id },
          data: {
            status: i.situacao,
          },
        })
      )
    );
    avisarResultados(turma.disciplina.nome, situacoes);

    res.json(await inscricoesDoDiario(turma.id));
  })
);

router.post(
  '/turmas/:id/reabrir',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req);
    const turma = await prisma.turma.findUnique({ where: { id: turmaId }, select: { id: true } });
    if (!turma) throw new HttpError(404, 'Turma não encontrada');
    await prisma.inscricao.updateMany({
      where: {
        turmaId,
        status: { in: ['APROVADO', 'REPROVADO_NOTA', 'REPROVADO_FALTA'] },
      },
      data: { status: 'CURSANDO' },
    });
    res.status(204).end();
  })
);

// ---------- Avaliações ----------

router.post(
  '/turmas/:id/avaliacoes',
  asyncHandler(async (req, res) => {
    const turma = await carregarTurmaDoProfessor(req, idParam(req), { leituraSecretaria: false });
    const dados = validar(avaliacaoSchema, req.body);
    const avaliacao = await prisma.avaliacao.create({
      data: {
        turmaId: turma.id,
        nome: dados.nome,
        peso: dados.peso,
        data: new Date(dados.data),
        notaMaxima: dados.notaMaxima,
      },
    });
    await recalcularTurma(turma.id);
    res.status(201).json(avaliacao);
  })
);

router.put(
  '/avaliacoes/:id',
  asyncHandler(async (req, res) => {
    const atual = await carregarAvaliacao(req, idParam(req));
    const dados = validar(avaliacaoAtualizarSchema, req.body);
    const avaliacao = await prisma.avaliacao.update({
      where: { id: atual.id },
      data: {
        nome: dados.nome,
        peso: dados.peso,
        data: dados.data !== undefined ? new Date(dados.data) : undefined,
        notaMaxima: dados.notaMaxima,
      },
    });
    await recalcularTurma(atual.turmaId);
    res.json(avaliacao);
  })
);

router.delete(
  '/avaliacoes/:id',
  asyncHandler(async (req, res) => {
    const atual = await carregarAvaliacao(req, idParam(req));
    await prisma.avaliacao.delete({ where: { id: atual.id } });
    await recalcularTurma(atual.turmaId);
    res.status(204).end();
  })
);

router.put(
  '/avaliacoes/:id/notas',
  asyncHandler(async (req, res) => {
    const avaliacao = await carregarAvaliacao(req, idParam(req));
    const dados = validar(notasSchema, req.body);

    for (const n of dados.notas) {
      if (n.valor < 0 || n.valor > avaliacao.notaMaxima) {
        throw new HttpError(400, `Nota deve estar entre 0 e ${avaliacao.notaMaxima}`);
      }
    }
    const ids = dados.notas.map((n) => n.inscricaoId);
    await validarInscricoesDaTurma(avaliacao.turmaId, ids);

    await prisma.$transaction(
      dados.notas.map((n) =>
        prisma.nota.upsert({
          where: {
            avaliacaoId_inscricaoId: { avaliacaoId: avaliacao.id, inscricaoId: n.inscricaoId },
          },
          create: { avaliacaoId: avaliacao.id, inscricaoId: n.inscricaoId, valor: n.valor },
          update: { valor: n.valor },
        })
      )
    );
    await recalcularInscricoes(ids);
    avisarNotas(avaliacao, ids);
    res.status(204).end();
  })
);

// ---------- Aulas e presenças ----------

router.post(
  '/turmas/:id/aulas',
  asyncHandler(async (req, res) => {
    const turma = await carregarTurmaDoProfessor(req, idParam(req), { leituraSecretaria: false });
    const dados = validar(aulaSchema, req.body);
    await validarInscricoesDaTurma(
      turma.id,
      dados.presencas.map((p) => p.inscricaoId)
    );
    const aula = await prisma.aula.create({
      data: {
        turmaId: turma.id,
        data: new Date(dados.data),
        conteudo: dados.conteudo ?? null,
        presencas: {
          create: dados.presencas.map((p) => ({ inscricaoId: p.inscricaoId, presente: p.presente })),
        },
      },
      include: { presencas: true },
    });
    await recalcularTurma(turma.id);
    res.status(201).json(paraAulaResposta(aula));
  })
);

router.get(
  '/aulas/:id',
  asyncHandler(async (req, res) => {
    const aula = await prisma.aula.findUnique({
      where: { id: idParam(req) },
      include: { presencas: true },
    });
    if (!aula) throw new HttpError(404, 'Aula não encontrada');
    await carregarTurmaDoProfessor(req, aula.turmaId, { leituraSecretaria: true });
    res.json(paraAulaResposta(aula));
  })
);

router.put(
  '/aulas/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const existente = await prisma.aula.findUnique({ where: { id }, select: { turmaId: true } });
    if (!existente) throw new HttpError(404, 'Aula não encontrada');
    const turma = await carregarTurmaDoProfessor(req, existente.turmaId, {
      leituraSecretaria: false,
    });
    const dados = validar(aulaSchema, req.body);
    await validarInscricoesDaTurma(
      turma.id,
      dados.presencas.map((p) => p.inscricaoId)
    );

    const aula = await prisma.$transaction(async (tx) => {
      await tx.presenca.deleteMany({ where: { aulaId: id } });
      return tx.aula.update({
        where: { id },
        data: {
          data: new Date(dados.data),
          conteudo: dados.conteudo ?? null,
          presencas: {
            create: dados.presencas.map((p) => ({ inscricaoId: p.inscricaoId, presente: p.presente })),
          },
        },
        include: { presencas: true },
      });
    });
    await recalcularTurma(turma.id);
    res.json(paraAulaResposta(aula));
  })
);

router.delete(
  '/aulas/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const existente = await prisma.aula.findUnique({ where: { id }, select: { turmaId: true } });
    if (!existente) throw new HttpError(404, 'Aula não encontrada');
    const turma = await carregarTurmaDoProfessor(req, existente.turmaId, {
      leituraSecretaria: false,
    });
    await prisma.aula.delete({ where: { id } });
    await recalcularTurma(turma.id);
    res.status(204).end();
  })
);

// ---------- Boletim e histórico ----------
// "meu" declarado antes das rotas com :matriculaId

router.get(
  '/boletim/meu',
  asyncHandler(async (req, res) => {
    const matriculaId = await matriculaDoAlunoLogado(req);
    res.json(await montarBoletim(matriculaId));
  })
);

router.get(
  '/boletim/:matriculaId',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    res.json(await montarBoletim(idParam(req, 'matriculaId')));
  })
);

router.get(
  '/historico/meu',
  asyncHandler(async (req, res) => {
    const matriculaId = await matriculaDoAlunoLogado(req);
    res.json(await montarHistorico(matriculaId));
  })
);

router.get(
  '/historico/:matriculaId',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    res.json(await montarHistorico(idParam(req, 'matriculaId')));
  })
);

export default router;
