import { Router, Request } from 'express';
import type { Prisma, MaterialAula, PlanoAula, Perfil } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import type { UsuarioToken } from '../../lib/auth';
import {
  acessoTurma,
  acessoDeEdicao,
  usuariosDosAlunosDaTurma,
} from '../../lib/turmas';
import type { PapelNaTurma } from '../../lib/turmas';
import { notificar } from '../../lib/notificacoes';
import { apagarArquivosDe, arquivosDe, definirArquivos } from '../../lib/arquivos';
import type { ArquivoDTO } from '../../lib/arquivos';

// Contrato B (docs/plano/sexta-leva.md): salas, materiais, plano de aula e andamento.

const router = Router();

const LIMITE_SALAS_GESTAO = 300;

type Papel = PapelNaTurma;

// Só para montar o select; o tipo da turma com estes campos sai do próprio Prisma.
const SELECAO_TURMA = {
  id: true,
  codigo: true,
  disciplina: { select: { nome: true, codigo: true } },
  periodoLetivo: { select: { id: true, nome: true } },
  professor: { select: { usuario: { select: { nome: true } } } },
} as const;

type TurmaComDados = Prisma.TurmaGetPayload<{ select: typeof SELECAO_TURMA }>;

interface Pendencias {
  tarefas: number;
  provas: number;
}

interface SalaResumoDTO {
  id: number;
  codigo: string;
  disciplina: { nome: string; codigo: string };
  periodoLetivo: { id: number; nome: string };
  professor: { nome: string };
  papel: Papel;
  pendencias: Pendencias;
}

interface MaterialDTO {
  id: number;
  titulo: string;
  descricao: string;
  topico: string;
  link: string | null;
  criadoEm: string;
  autor: { nome: string };
  arquivos: ArquivoDTO[];
}

interface AulaResumo {
  id: number;
  data: Date;
  conteudo: string | null;
}

interface PlanoDTO {
  id: number;
  ordem: number;
  tema: string;
  objetivos: string;
  dataPrevista: string | null;
  aula: { id: number; data: string; conteudo: string | null } | null;
}

// ---------- Validação ----------

const idPositivo = z.number().int().positive();

const consultaPeriodo = z.object({
  periodoLetivoId: z.coerce.number().int().positive().optional(),
});

function ehLinkWeb(valor: string): boolean {
  try {
    const endereco = new URL(valor);
    return endereco.protocol === 'http:' || endereco.protocol === 'https:';
  } catch {
    return false;
  }
}

const corpoMaterial = z
  .object({
    titulo: z.string().trim().min(2).max(120),
    descricao: z.string().trim().max(2000).default(''),
    topico: z.string().trim().max(60).default(''),
    link: z.string().trim().max(500).nullish(),
    arquivoIds: z.array(idPositivo).max(10).default([]),
  })
  .superRefine((dados, ctx) => {
    const link = dados.link ? dados.link : '';
    if (link !== '' && !ehLinkWeb(link)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['link'],
        message: 'O link precisa começar com http:// ou https://',
      });
    }
    if (link === '' && dados.descricao === '' && dados.arquivoIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe um link, um arquivo ou uma descrição',
      });
    }
  });

// Data do plano: aceita ISO com hora ou só a data (AAAA-MM-DD, guardada ao meio-dia para não mudar de dia).
function paraData(valor: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor);
}

const dataIso = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((valor) => !Number.isNaN(paraData(valor).getTime()), 'Data inválida')
  .transform((valor) => paraData(valor));

const corpoPlano = z.object({
  tema: z.string().trim().min(2).max(160),
  objetivos: z.string().trim().max(2000).default(''),
  dataPrevista: dataIso.nullish(),
});

// PUT do item: os quatro campos são obrigatórios (nulo desliga a data ou a aula).
const corpoPlanoEdicao = z.object({
  tema: z.string().trim().min(2).max(160),
  objetivos: z.string().trim().max(2000).default(''),
  dataPrevista: dataIso.nullable(),
  aulaId: idPositivo.nullable(),
});

const corpoOrdem = z.object({
  ids: z.array(idPositivo).max(500),
});

// ---------- Auxiliares ----------

function usuarioAtual(req: Request): UsuarioToken {
  if (!req.usuario) {
    throw new HttpError(401, 'Não autenticado');
  }
  return req.usuario;
}

function resumoDaTurma(turma: TurmaComDados, papel: Papel, pendencias: Pendencias): SalaResumoDTO {
  return {
    id: turma.id,
    codigo: turma.codigo,
    disciplina: { nome: turma.disciplina.nome, codigo: turma.disciplina.codigo },
    periodoLetivo: { id: turma.periodoLetivo.id, nome: turma.periodoLetivo.nome },
    professor: { nome: turma.professor.usuario.nome },
    papel,
    pendencias,
  };
}

async function nomesDeUsuarios(ids: number[]): Promise<Map<number, string>> {
  const unicos = [...new Set(ids)];
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: unicos } },
    select: { id: true, nome: true },
  });
  return new Map(usuarios.map((usuario) => [usuario.id, usuario.nome] as const));
}

async function arquivosPorItem(ids: number[]): Promise<Map<number, ArquivoDTO[]>> {
  if (ids.length === 0) {
    return new Map();
  }
  return arquivosDe('MATERIAL', ids);
}

async function montarMateriais(materiais: MaterialAula[]): Promise<MaterialDTO[]> {
  const [nomes, arquivos] = await Promise.all([
    nomesDeUsuarios(materiais.map((material) => material.criadoPorId)),
    arquivosPorItem(materiais.map((material) => material.id)),
  ]);
  return materiais.map((material) => ({
    id: material.id,
    titulo: material.titulo,
    descricao: material.descricao,
    topico: material.topico,
    link: material.link,
    criadoEm: material.criadoEm.toISOString(),
    autor: { nome: nomes.get(material.criadoPorId) ?? '' },
    arquivos: arquivos.get(material.id) ?? [],
  }));
}

function planoDTO(item: PlanoAula, aula: AulaResumo | undefined): PlanoDTO {
  return {
    id: item.id,
    ordem: item.ordem,
    tema: item.tema,
    objetivos: item.objetivos,
    dataPrevista: item.dataPrevista ? item.dataPrevista.toISOString() : null,
    aula: aula ? { id: aula.id, data: aula.data.toISOString(), conteudo: aula.conteudo } : null,
  };
}

// Pendências do aluno por turma, em consultas em lote (sem consulta por item).
// turmaInscricoes: turmaId -> inscricaoId do aluno nessa turma.
async function pendenciasDoAluno(
  turmaInscricoes: Map<number, number>,
  agora: Date
): Promise<Map<number, Pendencias>> {
  const resultado = new Map<number, Pendencias>();
  for (const turmaId of turmaInscricoes.keys()) {
    resultado.set(turmaId, { tarefas: 0, provas: 0 });
  }
  const turmaIds = [...turmaInscricoes.keys()];
  if (turmaIds.length === 0) {
    return resultado;
  }
  const inscricoes = [...turmaInscricoes.values()];

  const [tarefas, provas] = await Promise.all([
    prisma.tarefa.findMany({
      where: { turmaId: { in: turmaIds }, prazo: { gt: agora } },
      select: {
        turmaId: true,
        entregas: {
          where: { inscricaoId: { in: inscricoes } },
          select: { inscricaoId: true },
        },
      },
    }),
    prisma.prova.findMany({
      where: {
        turmaId: { in: turmaIds },
        publicada: true,
        abreEm: { lte: agora },
        fechaEm: { gte: agora },
      },
      select: {
        turmaId: true,
        tentativas: {
          where: { inscricaoId: { in: inscricoes }, enviadaEm: { not: null } },
          select: { inscricaoId: true },
        },
      },
    }),
  ]);

  for (const tarefa of tarefas) {
    const inscricaoId = turmaInscricoes.get(tarefa.turmaId);
    const pendencias = resultado.get(tarefa.turmaId);
    if (inscricaoId === undefined || !pendencias) {
      continue;
    }
    if (!tarefa.entregas.some((entrega) => entrega.inscricaoId === inscricaoId)) {
      pendencias.tarefas += 1;
    }
  }

  for (const prova of provas) {
    const inscricaoId = turmaInscricoes.get(prova.turmaId);
    const pendencias = resultado.get(prova.turmaId);
    if (inscricaoId === undefined || !pendencias) {
      continue;
    }
    if (!prova.tentativas.some((tentativa) => tentativa.inscricaoId === inscricaoId)) {
      pendencias.provas += 1;
    }
  }

  return resultado;
}

// Filtro de turmas de acordo com o papel de quem pede. null = sem turmas para este usuário.
function condicaoDeTurmas(
  perfil: Perfil,
  professorId: number | null,
  alunoId: number | null
): { papel: Papel; condicao: Prisma.TurmaWhereInput } | null {
  if (perfil === 'ADMIN' || perfil === 'SECRETARIA') {
    return { papel: 'GESTAO', condicao: {} };
  }
  if (perfil === 'PROFESSOR' && professorId !== null) {
    return { papel: 'PROFESSOR', condicao: { professorId } };
  }
  if (perfil === 'ALUNO' && alunoId !== null) {
    return {
      papel: 'ALUNO',
      condicao: { inscricoes: { some: { status: { not: 'TRANCADO' }, matricula: { alunoId } } } },
    };
  }
  return null;
}

// ---------- Salas ----------

// Andamento vem antes de /salas/:turmaId para o Express não tratar "andamento" como id.
router.get(
  '/salas/andamento',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const { periodoLetivoId } = validar(consultaPeriodo, req.query);
    const filtro: Prisma.TurmaWhereInput = periodoLetivoId !== undefined ? { periodoLetivoId } : {};

    const turmas = await prisma.turma.findMany({
      where: filtro,
      orderBy: [{ periodoLetivo: { inicio: 'desc' } }, { disciplina: { nome: 'asc' } }, { id: 'asc' }],
      select: SELECAO_TURMA,
    });
    const ids = turmas.map((turma) => turma.id);

    const [planejadas, ministradas, aulas] = await Promise.all([
      prisma.planoAula.groupBy({
        by: ['turmaId'],
        where: { turmaId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.planoAula.groupBy({
        by: ['turmaId'],
        where: { turmaId: { in: ids }, aulaId: { not: null } },
        _count: { _all: true },
      }),
      prisma.aula.groupBy({
        by: ['turmaId'],
        where: { turmaId: { in: ids } },
        _count: { _all: true },
        _max: { data: true },
      }),
    ]);

    const mapaPlanejadas = new Map(planejadas.map((g) => [g.turmaId, g._count._all] as const));
    const mapaMinistradas = new Map(ministradas.map((g) => [g.turmaId, g._count._all] as const));
    const mapaAulas = new Map(aulas.map((g) => [g.turmaId, g] as const));

    res.json(
      turmas.map((turma) => {
        const aulaGrupo = mapaAulas.get(turma.id);
        const ultima = aulaGrupo?._max.data ?? null;
        return {
          turmaId: turma.id,
          codigo: turma.codigo,
          disciplina: { nome: turma.disciplina.nome, codigo: turma.disciplina.codigo },
          professor: { nome: turma.professor.usuario.nome },
          planejadas: mapaPlanejadas.get(turma.id) ?? 0,
          ministradas: mapaMinistradas.get(turma.id) ?? 0,
          aulas: aulaGrupo?._count._all ?? 0,
          ultimaAula: ultima ? ultima.toISOString() : null,
        };
      })
    );
  })
);

router.get(
  '/salas',
  asyncHandler(async (req, res) => {
    const { periodoLetivoId } = validar(consultaPeriodo, req.query);
    const usuario = usuarioAtual(req);
    const escopo = condicaoDeTurmas(usuario.perfil, usuario.professorId, usuario.alunoId);
    if (!escopo) {
      res.json([]);
      return;
    }
    const filtro: Prisma.TurmaWhereInput = periodoLetivoId !== undefined ? { periodoLetivoId } : {};

    const turmas = await prisma.turma.findMany({
      where: { ...escopo.condicao, ...filtro },
      orderBy: [{ periodoLetivo: { inicio: 'desc' } }, { disciplina: { nome: 'asc' } }, { id: 'asc' }],
      take: LIMITE_SALAS_GESTAO,
      select: SELECAO_TURMA,
    });

    let pendencias = new Map<number, Pendencias>();
    if (escopo.papel === 'ALUNO' && usuario.alunoId !== null) {
      const inscricoes = await prisma.inscricao.findMany({
        where: {
          turmaId: { in: turmas.map((turma) => turma.id) },
          status: { not: 'TRANCADO' },
          matricula: { alunoId: usuario.alunoId },
        },
        select: { id: true, turmaId: true },
      });
      const turmaInscricoes = new Map(inscricoes.map((i) => [i.turmaId, i.id] as const));
      pendencias = await pendenciasDoAluno(turmaInscricoes, new Date());
    }

    res.json(
      turmas.map((turma) =>
        resumoDaTurma(turma, escopo.papel, pendencias.get(turma.id) ?? { tarefas: 0, provas: 0 })
      )
    );
  })
);

router.get(
  '/salas/:turmaId',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    const acesso = await acessoTurma(req, turmaId);
    const turma = await prisma.turma.findUnique({ where: { id: turmaId }, select: SELECAO_TURMA });
    if (!turma) {
      throw new HttpError(404, 'Turma não encontrada');
    }

    let pendencias: Pendencias = { tarefas: 0, provas: 0 };
    if (acesso.papel === 'ALUNO' && acesso.inscricaoId !== null) {
      const mapa = await pendenciasDoAluno(new Map([[turmaId, acesso.inscricaoId]]), new Date());
      pendencias = mapa.get(turmaId) ?? pendencias;
    }

    const alunos = await prisma.inscricao.count({
      where: { turmaId, status: { not: 'TRANCADO' } },
    });

    res.json({
      ...resumoDaTurma(turma, acesso.papel, pendencias),
      podeEditar: acesso.podeEditar,
      alunos,
    });
  })
);

// ---------- Materiais ----------

router.get(
  '/salas/:turmaId/materiais',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    await acessoTurma(req, turmaId);
    const materiais = await prisma.materialAula.findMany({
      where: { turmaId },
      orderBy: [{ topico: 'asc' }, { criadoEm: 'asc' }, { id: 'asc' }],
    });
    res.json(await montarMateriais(materiais));
  })
);

router.post(
  '/salas/:turmaId/materiais',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    const acesso = await acessoDeEdicao(req, turmaId);
    const usuario = usuarioAtual(req);
    const dados = validar(corpoMaterial, req.body);
    const link = dados.link ? dados.link : null;

    const material = await prisma.materialAula.create({
      data: {
        turmaId,
        titulo: dados.titulo,
        descricao: dados.descricao,
        topico: dados.topico,
        link,
        criadoPorId: usuario.id,
      },
    });

    try {
      await definirArquivos(usuario.id, dados.arquivoIds, 'MATERIAL', material.id);
    } catch (erro) {
      // Sem anexos válidos, o material não fica pela metade.
      await prisma.materialAula.delete({ where: { id: material.id } });
      throw erro;
    }

    const alunos = await usuariosDosAlunosDaTurma(turmaId);
    notificar(alunos, {
      tipo: 'AULA',
      titulo: `Novo material em ${acesso.turma.disciplina.nome}: ${material.titulo}`,
      link: `/sala/${turmaId}`,
    });

    const [dto] = await montarMateriais([material]);
    res.status(201).json(dto);
  })
);

router.put(
  '/materiais/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await prisma.materialAula.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Material não encontrado');
    }
    await acessoDeEdicao(req, atual.turmaId);
    const usuario = usuarioAtual(req);
    const dados = validar(corpoMaterial, req.body);
    const link = dados.link ? dados.link : null;

    // Anexos primeiro: se algum for inválido, nada do material é alterado.
    await definirArquivos(usuario.id, dados.arquivoIds, 'MATERIAL', id);
    const material = await prisma.materialAula.update({
      where: { id },
      data: {
        titulo: dados.titulo,
        descricao: dados.descricao,
        topico: dados.topico,
        link,
      },
    });

    const [dto] = await montarMateriais([material]);
    res.json(dto);
  })
);

router.delete(
  '/materiais/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await prisma.materialAula.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Material não encontrado');
    }
    await acessoDeEdicao(req, atual.turmaId);
    await apagarArquivosDe('MATERIAL', [id]);
    await prisma.materialAula.delete({ where: { id } });
    res.status(204).end();
  })
);

// ---------- Plano de aula ----------

router.get(
  '/salas/:turmaId/plano',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    await acessoTurma(req, turmaId);

    const itens = await prisma.planoAula.findMany({
      where: { turmaId },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    });
    // PlanoAula guarda só o id da aula: busca as aulas ligadas em um lote.
    const aulasIds = itens
      .map((item) => item.aulaId)
      .filter((id): id is number => id !== null);
    const [aulas, aulasRegistradas] = await Promise.all([
      prisma.aula.findMany({
        where: { id: { in: aulasIds } },
        select: { id: true, data: true, conteudo: true },
      }),
      prisma.aula.count({ where: { turmaId } }),
    ]);
    const mapaAulas = new Map(aulas.map((aula) => [aula.id, aula] as const));

    const ministradas = itens.filter((item) => item.aulaId !== null).length;
    res.json({
      itens: itens.map((item) =>
        planoDTO(item, item.aulaId !== null ? mapaAulas.get(item.aulaId) : undefined)
      ),
      resumo: {
        planejadas: itens.length,
        ministradas,
        aulasRegistradas,
      },
    });
  })
);

router.post(
  '/salas/:turmaId/plano',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    await acessoDeEdicao(req, turmaId);
    const dados = validar(corpoPlano, req.body);

    const maximo = await prisma.planoAula.aggregate({
      where: { turmaId },
      _max: { ordem: true },
    });
    const item = await prisma.planoAula.create({
      data: {
        turmaId,
        ordem: (maximo._max.ordem ?? 0) + 1,
        tema: dados.tema,
        objetivos: dados.objetivos,
        dataPrevista: dados.dataPrevista ?? null,
      },
    });
    res.status(201).json(planoDTO(item, undefined));
  })
);

router.put(
  '/salas/:turmaId/plano/ordem',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    await acessoDeEdicao(req, turmaId);
    const { ids } = validar(corpoOrdem, req.body);

    const itens = await prisma.planoAula.findMany({
      where: { turmaId },
      select: { id: true },
    });
    const esperados = new Set(itens.map((item) => item.id));
    const recebidos = new Set(ids);
    const completa =
      recebidos.size === ids.length &&
      ids.length === esperados.size &&
      ids.every((id) => esperados.has(id));
    if (!completa) {
      throw new HttpError(400, 'A ordem precisa listar todos os temas da turma, uma vez cada');
    }

    await prisma.$transaction(
      ids.map((id, indice) => prisma.planoAula.update({ where: { id }, data: { ordem: indice + 1 } }))
    );
    res.status(204).end();
  })
);

router.put(
  '/plano/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await prisma.planoAula.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Tema não encontrado');
    }
    await acessoDeEdicao(req, atual.turmaId);
    const dados = validar(corpoPlanoEdicao, req.body);

    let aula: AulaResumo | undefined;
    if (dados.aulaId !== null) {
      const encontrada = await prisma.aula.findUnique({
        where: { id: dados.aulaId },
        select: { id: true, data: true, conteudo: true, turmaId: true },
      });
      if (!encontrada || encontrada.turmaId !== atual.turmaId) {
        throw new HttpError(400, 'A aula precisa ser desta turma');
      }
      aula = { id: encontrada.id, data: encontrada.data, conteudo: encontrada.conteudo };
    }

    const item = await prisma.planoAula.update({
      where: { id },
      data: {
        tema: dados.tema,
        objetivos: dados.objetivos,
        dataPrevista: dados.dataPrevista,
        aulaId: dados.aulaId,
      },
    });
    res.json(planoDTO(item, aula));
  })
);

router.delete(
  '/plano/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await prisma.planoAula.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Tema não encontrado');
    }
    await acessoDeEdicao(req, atual.turmaId);
    await prisma.planoAula.delete({ where: { id } });
    res.status(204).end();
  })
);

// ---------- Aulas do diário (para ligar ao plano) ----------

router.get(
  '/salas/:turmaId/aulas',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    await acessoTurma(req, turmaId);
    const aulas = await prisma.aula.findMany({
      where: { turmaId },
      orderBy: [{ data: 'desc' }, { id: 'desc' }],
      select: { id: true, data: true, conteudo: true },
    });
    res.json(
      aulas.map((aula) => ({
        id: aula.id,
        data: aula.data.toISOString(),
        conteudo: aula.conteudo,
      }))
    );
  })
);

export default router;
