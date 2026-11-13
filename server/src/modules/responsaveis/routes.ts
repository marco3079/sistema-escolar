import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { acessoAoAluno, vinculosDoResponsavel } from '../../lib/responsaveis';
import { montarBoletim, montarHistorico } from '../../lib/boletim';
import { vincularResponsavel } from './servico';

// Contrato A (docs/plano/setima-leva.md): responsáveis (gestão) e portal da família (/familia/...).

const router = Router();

const SEM_PERMISSAO = 'Sem permissão';
const LIMITE_BUSCA = 200;

// ---------- Validação ----------

const corpoVinculo = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do responsável').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(190),
  telefone: z.string().trim().max(30).nullish(),
  cpf: z.string().trim().max(14).nullish(),
  parentesco: z.string().trim().min(2, 'Informe o parentesco').max(40),
  financeiro: z.boolean().optional(),
});

const corpoAtualizarVinculo = z.object({
  parentesco: z.string().trim().min(2, 'Informe o parentesco').max(40),
  financeiro: z.boolean(),
});

const consultaBusca = z.object({
  busca: z.string().trim().max(120).optional(),
});

const consultaMatricula = z.object({
  matriculaId: z.coerce.number().int().positive().optional(),
});

// ---------- Gestão: seleções e formatos ----------

const SELECAO_VINCULO = {
  id: true,
  usuarioId: true,
  parentesco: true,
  financeiro: true,
  usuario: { select: { nome: true, email: true, telefone: true, ativo: true } },
} as const;

type VinculoComUsuario = Prisma.ResponsavelAlunoGetPayload<{ select: typeof SELECAO_VINCULO }>;

function paraVinculo(v: VinculoComUsuario) {
  return {
    vinculoId: v.id,
    usuarioId: v.usuarioId,
    nome: v.usuario.nome,
    email: v.usuario.email,
    telefone: v.usuario.telefone,
    parentesco: v.parentesco,
    financeiro: v.financeiro,
    ativo: v.usuario.ativo,
  };
}

async function alunoExistente(alunoId: number): Promise<void> {
  const existe = await prisma.aluno.findUnique({ where: { id: alunoId }, select: { id: true } });
  if (!existe) throw new HttpError(404, 'Aluno não encontrado');
}

// ---------- Portal da família: cálculos ----------

// Mesma regra do financeiro: ABERTA com vencimento antes do início de hoje conta como ATRASADA.
function inicioDeHoje(): Date {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

// Idade em anos completos, lendo a data de nascimento em UTC (como em fichas/routes.ts).
function idadeEm(data: Date): number {
  const hoje = new Date();
  let anos = hoje.getFullYear() - data.getUTCFullYear();
  const antesDoAniversario =
    hoje.getMonth() < data.getUTCMonth() ||
    (hoje.getMonth() === data.getUTCMonth() && hoje.getDate() < data.getUTCDate());
  if (antesDoAniversario) anos -= 1;
  return anos;
}

function arredondar1(n: number): number {
  return Math.round(n * 10) / 10;
}

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mediaArred1(valores: (number | null)[]): number | null {
  const nums = valores.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return arredondar1(nums.reduce((soma, v) => soma + v, 0) / nums.length);
}

// AAAA-MM-DD a partir de uma data gravada como meia-noite UTC.
function dataIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

// Id do período mais recente (maior início) entre as inscrições; null sem inscrições.
function periodoMaisRecenteId(
  inscricoes: { turma: { periodoLetivo: { id: number; inicio: Date } } }[]
): number | null {
  let escolhido: { id: number; inicio: Date } | null = null;
  for (const i of inscricoes) {
    const periodo = i.turma.periodoLetivo;
    if (!escolhido || periodo.inicio.getTime() > escolhido.inicio.getTime()) {
      escolhido = periodo;
    }
  }
  return escolhido ? escolhido.id : null;
}

// Matrícula usada nas telas do portal: ?matriculaId= (precisa ser do aluno; senão 403),
// ou a primeira ATIVA, senão a mais recente.
async function resolverMatricula(alunoId: number, matriculaId: number | undefined): Promise<number> {
  if (matriculaId !== undefined) {
    const matricula = await prisma.matricula.findUnique({
      where: { id: matriculaId },
      select: { alunoId: true },
    });
    if (!matricula || matricula.alunoId !== alunoId) throw new HttpError(403, SEM_PERMISSAO);
    return matriculaId;
  }
  const ativa = await prisma.matricula.findFirst({
    where: { alunoId, status: 'ATIVA' },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (ativa) return ativa.id;
  const recente = await prisma.matricula.findFirst({
    where: { alunoId },
    orderBy: [{ dataMatricula: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  if (!recente) throw new HttpError(404, 'Nenhuma matrícula encontrada');
  return recente.id;
}

// ---------- Gestão de responsáveis ----------

router.get(
  '/alunos/:alunoId/responsaveis',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const alunoId = idParam(req, 'alunoId');
    await alunoExistente(alunoId);
    const vinculos = await prisma.responsavelAluno.findMany({
      where: { alunoId },
      orderBy: { id: 'asc' },
      select: SELECAO_VINCULO,
    });
    res.json(vinculos.map(paraVinculo));
  })
);

router.post(
  '/alunos/:alunoId/responsaveis',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const alunoId = idParam(req, 'alunoId');
    await alunoExistente(alunoId);
    const dados = validar(corpoVinculo, req.body);
    const resultado = await vincularResponsavel(alunoId, dados);
    res.status(201).json(resultado);
  })
);

router.put(
  '/responsaveis/vinculos/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req, 'id');
    const dados = validar(corpoAtualizarVinculo, req.body);
    const existe = await prisma.responsavelAluno.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new HttpError(404, 'Vínculo não encontrado');
    const atualizado = await prisma.responsavelAluno.update({
      where: { id },
      data: { parentesco: dados.parentesco.trim(), financeiro: dados.financeiro },
      select: SELECAO_VINCULO,
    });
    res.json(paraVinculo(atualizado));
  })
);

router.delete(
  '/responsaveis/vinculos/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req, 'id');
    const existe = await prisma.responsavelAluno.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new HttpError(404, 'Vínculo não encontrado');
    // Só o vínculo é removido; o usuário continua existindo.
    await prisma.responsavelAluno.delete({ where: { id } });
    res.status(204).end();
  })
);

router.get(
  '/responsaveis',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const { busca } = validar(consultaBusca, req.query);
    const termo = busca ?? '';
    const where: Prisma.UsuarioWhereInput = { perfil: 'RESPONSAVEL' };
    if (termo !== '') {
      where.OR = [
        { nome: { contains: termo, mode: 'insensitive' } },
        { email: { contains: termo, mode: 'insensitive' } },
      ];
    }
    const usuarios = await prisma.usuario.findMany({
      where,
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      take: LIMITE_BUSCA,
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        ativo: true,
        alunosSobResponsabilidade: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            alunoId: true,
            parentesco: true,
            aluno: { select: { ra: true, usuario: { select: { nome: true } } } },
          },
        },
      },
    });
    res.json(
      usuarios.map((u) => ({
        usuarioId: u.id,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone,
        ativo: u.ativo,
        alunos: u.alunosSobResponsabilidade.map((v) => ({
          vinculoId: v.id,
          alunoId: v.alunoId,
          nome: v.aluno.usuario.nome,
          ra: v.aluno.ra,
          parentesco: v.parentesco,
        })),
      }))
    );
  })
);

// ---------- Portal da família (/familia/...) ----------

const SELECAO_ALUNO_FAMILIA = {
  id: true,
  ra: true,
  dataNascimento: true,
  usuario: { select: { nome: true, foto: true } },
  matriculas: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      status: true,
      serieAtual: true,
      curso: { select: { nome: true, nivel: true } },
    },
  },
} as const;

router.get(
  '/familia/alunos',
  permitir('RESPONSAVEL'),
  asyncHandler(async (req, res) => {
    const vinculos = await vinculosDoResponsavel(req.usuario.id);
    if (vinculos.length === 0) {
      res.json([]);
      return;
    }
    const alunoIds = vinculos.map((v) => v.alunoId);

    // Um conjunto de consultas para todos os alunos (sem consulta por aluno).
    const alunos = await prisma.aluno.findMany({
      where: { id: { in: alunoIds } },
      select: SELECAO_ALUNO_FAMILIA,
    });
    const porId = new Map(alunos.map((a) => [a.id, a]));

    const matriculaAtivaPorAluno = new Map<number, number>();
    for (const a of alunos) {
      const ativa = a.matriculas.find((m) => m.status === 'ATIVA');
      if (ativa) matriculaAtivaPorAluno.set(a.id, ativa.id);
    }
    const ativasIds = [...matriculaAtivaPorAluno.values()];
    const todasMatriculaIds = alunos.flatMap((a) => a.matriculas.map((m) => m.id));
    const alunoDeMatricula = new Map<number, number>();
    for (const a of alunos) {
      for (const m of a.matriculas) alunoDeMatricula.set(m.id, a.id);
    }

    const inscricoes =
      ativasIds.length === 0
        ? []
        : await prisma.inscricao.findMany({
            where: { matriculaId: { in: ativasIds } },
            select: {
              matriculaId: true,
              notaFinal: true,
              frequencia: true,
              turma: { select: { periodoLetivo: { select: { id: true, inicio: true } } } },
            },
          });

    const mensalidades =
      todasMatriculaIds.length === 0
        ? []
        : await prisma.mensalidade.findMany({
            where: { matriculaId: { in: todasMatriculaIds }, status: { in: ['ABERTA', 'ATRASADA'] } },
            select: { matriculaId: true, status: true, vencimento: true },
          });

    const ocorrencias =
      alunoIds.length === 0
        ? []
        : await prisma.ocorrencia.groupBy({
            by: ['alunoId'],
            where: { alunoId: { in: alunoIds }, visivelFamilia: true, cienteEm: null },
            _count: { _all: true },
          });
    const semCienciaPorAluno = new Map(ocorrencias.map((o) => [o.alunoId, o._count._all]));

    const hoje = inicioDeHoje();
    const resumoPorAluno = new Map<
      number,
      { mensalidadesAbertas: number; mensalidadesAtrasadas: number }
    >();
    for (const alunoId of alunoIds) resumoPorAluno.set(alunoId, { mensalidadesAbertas: 0, mensalidadesAtrasadas: 0 });
    for (const m of mensalidades) {
      const alunoId = alunoDeMatricula.get(m.matriculaId);
      if (alunoId === undefined) continue;
      const contagem = resumoPorAluno.get(alunoId);
      if (!contagem) continue;
      const atrasada = m.status === 'ATRASADA' || m.vencimento.getTime() < hoje.getTime();
      contagem.mensalidadesAbertas += 1;
      if (atrasada) contagem.mensalidadesAtrasadas += 1;
    }

    const resposta = vinculos.flatMap((v) => {
      const a = porId.get(v.alunoId);
      if (!a) return [];
      const matriculaAtiva = matriculaAtivaPorAluno.get(a.id);
      let mediaGeral: number | null = null;
      let frequenciaMedia: number | null = null;
      if (matriculaAtiva !== undefined) {
        const inscricoesDaMatricula = inscricoes.filter((i) => i.matriculaId === matriculaAtiva);
        const periodoId = periodoMaisRecenteId(inscricoesDaMatricula);
        const doPeriodo = inscricoesDaMatricula.filter((i) => i.turma.periodoLetivo.id === periodoId);
        mediaGeral = mediaArred1(doPeriodo.map((i) => i.notaFinal));
        frequenciaMedia = mediaArred1(doPeriodo.map((i) => i.frequencia));
      }
      const contagem = resumoPorAluno.get(a.id) ?? { mensalidadesAbertas: 0, mensalidadesAtrasadas: 0 };
      return [
        {
          alunoId: a.id,
          nome: a.usuario.nome,
          ra: a.ra,
          foto: a.usuario.foto,
          idade: idadeEm(a.dataNascimento),
          parentesco: v.parentesco,
          financeiro: v.financeiro,
          matriculas: a.matriculas.map((m) => ({
            id: m.id,
            curso: m.curso.nome,
            nivel: m.curso.nivel,
            status: m.status,
            serieAtual: m.serieAtual,
          })),
          resumo: {
            mediaGeral,
            frequenciaMedia,
            mensalidadesAbertas: contagem.mensalidadesAbertas,
            mensalidadesAtrasadas: contagem.mensalidadesAtrasadas,
            ocorrenciasSemCiencia: semCienciaPorAluno.get(a.id) ?? 0,
          },
        },
      ];
    });

    res.json(resposta);
  })
);

router.get(
  '/familia/alunos/:alunoId/boletim',
  asyncHandler(async (req, res) => {
    const alunoId = idParam(req, 'alunoId');
    await acessoAoAluno(req, alunoId);
    await alunoExistente(alunoId);
    const { matriculaId } = validar(consultaMatricula, req.query);
    res.json(await montarBoletim(await resolverMatricula(alunoId, matriculaId)));
  })
);

router.get(
  '/familia/alunos/:alunoId/historico',
  asyncHandler(async (req, res) => {
    const alunoId = idParam(req, 'alunoId');
    await acessoAoAluno(req, alunoId);
    await alunoExistente(alunoId);
    const { matriculaId } = validar(consultaMatricula, req.query);
    res.json(await montarHistorico(await resolverMatricula(alunoId, matriculaId)));
  })
);

router.get(
  '/familia/alunos/:alunoId/frequencia',
  asyncHandler(async (req, res) => {
    const alunoId = idParam(req, 'alunoId');
    await acessoAoAluno(req, alunoId);
    await alunoExistente(alunoId);
    const { matriculaId } = validar(consultaMatricula, req.query);
    const matriculaEscolhida = await resolverMatricula(alunoId, matriculaId);

    const inscricoes = await prisma.inscricao.findMany({
      where: { matriculaId: matriculaEscolhida },
      select: {
        id: true,
        turmaId: true,
        turma: {
          select: {
            codigo: true,
            disciplina: { select: { nome: true } },
            periodoLetivo: { select: { id: true, inicio: true } },
          },
        },
      },
    });
    const periodoId = periodoMaisRecenteId(inscricoes);
    const doPeriodo = inscricoes.filter((i) => i.turma.periodoLetivo.id === periodoId);
    if (doPeriodo.length === 0) {
      res.json([]);
      return;
    }

    const presencas = await prisma.presenca.findMany({
      where: { inscricaoId: { in: doPeriodo.map((i) => i.id) } },
      select: { inscricaoId: true, presente: true, aula: { select: { data: true } } },
    });

    const resposta = doPeriodo.map((i) => {
      const registros = presencas.filter((p) => p.inscricaoId === i.id);
      const aulas = registros.length;
      const presencasCount = registros.filter((p) => p.presente).length;
      const faltas = aulas - presencasCount;
      const ultimasFaltas = registros
        .filter((p) => !p.presente)
        .sort((x, y) => y.aula.data.getTime() - x.aula.data.getTime())
        .slice(0, 5)
        .map((p) => dataIso(p.aula.data));
      return {
        turmaId: i.turmaId,
        turma: i.turma.codigo,
        disciplina: i.turma.disciplina.nome,
        aulas,
        presencas: presencasCount,
        faltas,
        percentual: aulas > 0 ? arredondar1((presencasCount / aulas) * 100) : null,
        ultimasFaltas,
      };
    });

    res.json(resposta);
  })
);

router.get(
  '/familia/alunos/:alunoId/mensalidades',
  asyncHandler(async (req, res) => {
    const alunoId = idParam(req, 'alunoId');
    const acesso = await acessoAoAluno(req, alunoId);
    await alunoExistente(alunoId);
    if (!acesso.financeiro) throw new HttpError(403, SEM_PERMISSAO);
    const { matriculaId } = validar(consultaMatricula, req.query);
    const matriculaEscolhida = await resolverMatricula(alunoId, matriculaId);

    const mensalidades = await prisma.mensalidade.findMany({
      where: { matriculaId: matriculaEscolhida },
      orderBy: [{ vencimento: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        competencia: true,
        vencimento: true,
        valor: true,
        desconto: true,
        status: true,
        pagoEm: true,
      },
    });

    const hoje = inicioDeHoje();
    res.json(
      mensalidades.map((m) => ({
        id: m.id,
        competencia: m.competencia,
        vencimento: m.vencimento,
        valor: m.valor,
        desconto: m.desconto,
        valorFinal: arredondar2(Math.max(0, m.valor - m.desconto)),
        status:
          m.status === 'ABERTA' && m.vencimento.getTime() < hoje.getTime() ? 'ATRASADA' : m.status,
        pagoEm: m.pagoEm,
      }))
    );
  })
);

export default router;
