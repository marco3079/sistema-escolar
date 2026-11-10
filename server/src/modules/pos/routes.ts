import { Request, Router } from 'express';
import { z } from 'zod';
import type { Prisma, PapelBanca, ResultadoBanca, StatusProjeto, TipoBanca } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { ehPos } from '../../lib/regras';

const router = Router();

const SEM_PERMISSAO = 'Sem permissão';
const STATUS_PROJETO = ['EM_ELABORACAO', 'QUALIFICADO', 'APROVADO', 'REPROVADO'] as const;
const TIPOS_BANCA = ['QUALIFICACAO', 'DEFESA'] as const;
const RESULTADOS_BANCA = ['PENDENTE', 'APROVADO', 'APROVADO_COM_RESSALVAS', 'REPROVADO'] as const;
const PAPEIS_BANCA = ['PRESIDENTE', 'INTERNO', 'EXTERNO', 'SUPLENTE'] as const;
const CAMPOS_ALUNO = ['titulo', 'resumo', 'linhaPesquisa'];

// include da banca: membros com o nome do professor (membro interno)
const incluirBanca = {
  membros: {
    include: { professor: { include: { usuario: { select: { nome: true } } } } },
  },
} satisfies Prisma.BancaInclude;

// include do ProjetoDTO (formato da seção 5.6 do contrato)
const incluirProjeto = {
  matricula: {
    select: {
      id: true,
      aluno: { select: { ra: true, usuario: { select: { nome: true } } } },
      curso: { select: { id: true, nome: true, nivel: true } },
    },
  },
  orientador: { select: { id: true, usuario: { select: { nome: true } } } },
  coorientador: { select: { id: true, usuario: { select: { nome: true } } } },
  bancas: { orderBy: { data: 'asc' }, include: incluirBanca },
} satisfies Prisma.ProjetoPesquisaInclude;

// ---------- Schemas ----------

const dataIso = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida');
const textoOpcional = z.string().trim().nullable().optional();
const idOpcional = z.number().int().positive().nullable().optional();

const filtroListaSchema = z.object({
  status: z.enum(STATUS_PROJETO).optional(),
});

const criarProjetoSchema = z.object({
  matriculaId: z.number().int().positive(),
  orientadorId: z.number().int().positive(),
  coorientadorId: idOpcional,
  titulo: z.string().trim().min(1),
  resumo: z.string().trim().min(1),
  linhaPesquisa: textoOpcional,
});

const atualizarProjetoSchema = z.object({
  titulo: z.string().trim().min(1).optional(),
  resumo: z.string().trim().min(1).optional(),
  linhaPesquisa: textoOpcional,
  orientadorId: z.number().int().positive().optional(),
  coorientadorId: idOpcional,
  status: z.enum(STATUS_PROJETO).optional(),
});

const atualizarProjetoAlunoSchema = atualizarProjetoSchema.pick({
  titulo: true,
  resumo: true,
  linhaPesquisa: true,
});

const membroSchema = z.object({
  professorId: z.number().int().positive().nullable().optional(),
  nomeExterno: z.string().trim().nullable().optional(),
  instituicao: z.string().trim().nullable().optional(),
  papel: z.enum(PAPEIS_BANCA),
});

const criarBancaSchema = z.object({
  tipo: z.enum(TIPOS_BANCA),
  data: dataIso,
  local: textoOpcional,
  membros: z.array(membroSchema),
});

const atualizarBancaSchema = z.object({
  data: dataIso.optional(),
  local: textoOpcional,
  resultado: z.enum(RESULTADOS_BANCA).optional(),
  parecer: textoOpcional,
  membros: z.array(membroSchema).optional(),
});

type AtualizarProjeto = z.infer<typeof atualizarProjetoSchema>;

// ---------- Auxiliares ----------

// where de leitura de projetos conforme o perfil do usuário logado
function filtroDoUsuario(req: Request): Prisma.ProjetoPesquisaWhereInput {
  const { perfil, professorId, alunoId } = req.usuario;
  if (perfil === 'ADMIN' || perfil === 'SECRETARIA') return {};
  if (perfil === 'PROFESSOR') {
    if (professorId === null) throw new HttpError(403, SEM_PERMISSAO);
    return { OR: [{ orientadorId: professorId }, { coorientadorId: professorId }] };
  }
  if (perfil === 'ALUNO') {
    if (alunoId === null) throw new HttpError(403, SEM_PERMISSAO);
    return { matricula: { alunoId } };
  }
  throw new HttpError(403, SEM_PERMISSAO);
}

async function garantirProfessor(id: number, papel: 'Orientador' | 'Coorientador'): Promise<void> {
  const quantidade = await prisma.professor.count({ where: { id } });
  if (quantidade === 0) throw new HttpError(400, `${papel} não encontrado`);
}

// valida os membros da banca e devolve os dados prontos para gravar
async function prepararMembros(entrada: z.infer<typeof membroSchema>[]) {
  const membros = entrada.map((m) => {
    const professorId = m.professorId ?? null;
    const nomeExterno = m.nomeExterno || null;
    if ((professorId === null) === (nomeExterno === null)) {
      throw new HttpError(400, 'Cada membro precisa de professor ou de nome externo, nunca de ambos');
    }
    return {
      professorId,
      nomeExterno,
      instituicao: m.instituicao || null,
      papel: m.papel as PapelBanca,
    };
  });

  if (!membros.some((m) => m.papel === 'PRESIDENTE')) {
    throw new HttpError(400, 'A banca precisa de pelo menos um membro com papel Presidente');
  }

  const ids = [...new Set(membros.flatMap((m) => (m.professorId === null ? [] : [m.professorId])))];
  if (ids.length > 0) {
    const encontrados = await prisma.professor.count({ where: { id: { in: ids } } });
    if (encontrados !== ids.length) {
      throw new HttpError(400, 'Professor da banca não encontrado');
    }
  }
  return membros;
}

// regra de status do projeto ao gravar o resultado de uma banca
function statusDoResultado(tipo: TipoBanca, resultado: ResultadoBanca | undefined): StatusProjeto | null {
  if (!resultado) return null;
  if (tipo === 'QUALIFICACAO' && (resultado === 'APROVADO' || resultado === 'APROVADO_COM_RESSALVAS')) {
    return 'QUALIFICADO';
  }
  if (tipo === 'DEFESA' && resultado === 'APROVADO') return 'APROVADO';
  if (tipo === 'DEFESA' && resultado === 'REPROVADO') return 'REPROVADO';
  return null;
}

// ---------- Projetos ----------

router.get(
  '/pos/projetos',
  asyncHandler(async (req, res) => {
    const { status } = validar(filtroListaSchema, req.query);
    const where: Prisma.ProjetoPesquisaWhereInput = {
      ...filtroDoUsuario(req),
      ...(status ? { status } : {}),
    };
    res.json(
      await prisma.projetoPesquisa.findMany({
        where,
        include: incluirProjeto,
        orderBy: { titulo: 'asc' },
      })
    );
  })
);

router.get(
  '/pos/projetos/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const projeto = await prisma.projetoPesquisa.findFirst({
      where: { id, ...filtroDoUsuario(req) },
      include: incluirProjeto,
    });
    if (!projeto) throw new HttpError(404, 'Projeto não encontrado');
    res.json(projeto);
  })
);

router.post(
  '/pos/projetos',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(criarProjetoSchema, req.body);
    const coorientadorId = dados.coorientadorId ?? null;
    if (coorientadorId !== null && coorientadorId === dados.orientadorId) {
      throw new HttpError(400, 'Orientador e coorientador não podem ser a mesma pessoa');
    }

    const matricula = await prisma.matricula.findUnique({
      where: { id: dados.matriculaId },
      include: {
        curso: { select: { nivel: true } },
        projeto: { select: { id: true } },
      },
    });
    if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');
    if (!ehPos(matricula.curso.nivel)) throw new HttpError(409, 'Curso não é de pós-graduação');
    if (matricula.projeto) throw new HttpError(409, 'Matrícula já possui projeto');

    await garantirProfessor(dados.orientadorId, 'Orientador');
    if (coorientadorId !== null) await garantirProfessor(coorientadorId, 'Coorientador');

    const criado = await prisma.projetoPesquisa.create({
      data: {
        matriculaId: dados.matriculaId,
        orientadorId: dados.orientadorId,
        coorientadorId,
        titulo: dados.titulo,
        resumo: dados.resumo,
        linhaPesquisa: dados.linhaPesquisa ?? null,
      },
      include: incluirProjeto,
    });
    res.status(201).json(criado);
  })
);

router.put(
  '/pos/projetos/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const { perfil } = req.usuario;
    const eAdmin = perfil === 'ADMIN' || perfil === 'SECRETARIA';
    if (!eAdmin && perfil !== 'ALUNO') throw new HttpError(403, SEM_PERMISSAO);

    const brutos = typeof req.body === 'object' && req.body !== null ? req.body : {};
    if (!eAdmin) {
      const extras = Object.keys(brutos).filter((campo) => !CAMPOS_ALUNO.includes(campo));
      if (extras.length > 0) {
        throw new HttpError(403, 'Aluno só pode alterar título, resumo e linha de pesquisa');
      }
    }

    const dados: AtualizarProjeto = eAdmin
      ? validar(atualizarProjetoSchema, req.body)
      : validar(atualizarProjetoAlunoSchema, req.body);

    // ALUNO dono ou ADMIN/SECRETARIA; aluno que não é dono recebe 404
    const projeto = await prisma.projetoPesquisa.findFirst({
      where: { id, ...filtroDoUsuario(req) },
    });
    if (!projeto) throw new HttpError(404, 'Projeto não encontrado');

    const orientadorFinal = dados.orientadorId ?? projeto.orientadorId;
    const coorientadorFinal =
      dados.coorientadorId !== undefined ? dados.coorientadorId : projeto.coorientadorId;
    if (coorientadorFinal !== null && coorientadorFinal === orientadorFinal) {
      throw new HttpError(400, 'Orientador e coorientador não podem ser a mesma pessoa');
    }
    if (dados.orientadorId !== undefined) await garantirProfessor(dados.orientadorId, 'Orientador');
    if (dados.coorientadorId) await garantirProfessor(dados.coorientadorId, 'Coorientador');

    const atualizado = await prisma.projetoPesquisa.update({
      where: { id },
      data: dados,
      include: incluirProjeto,
    });
    res.json(atualizado);
  })
);

// ---------- Bancas ----------

router.post(
  '/pos/projetos/:id/bancas',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const projetoId = idParam(req);
    const dados = validar(criarBancaSchema, req.body);
    const membros = await prepararMembros(dados.membros);

    const projeto = await prisma.projetoPesquisa.findUnique({
      where: { id: projetoId },
      select: {
        status: true,
        matricula: { select: { curso: { select: { nivel: true } } } },
      },
    });
    if (!projeto) throw new HttpError(404, 'Projeto não encontrado');

    const nivel = projeto.matricula.curso.nivel;
    const ehMestradoOuDoutorado = nivel === 'MESTRADO' || nivel === 'DOUTORADO';
    if (dados.tipo === 'DEFESA' && ehMestradoOuDoutorado && projeto.status !== 'QUALIFICADO') {
      throw new HttpError(409, 'O projeto precisa estar qualificado antes da defesa');
    }

    const banca = await prisma.$transaction(async (tx) => {
      const nova = await tx.banca.create({
        data: {
          projetoId,
          tipo: dados.tipo,
          data: new Date(dados.data),
          local: dados.local ?? null,
        },
      });
      await tx.bancaMembro.createMany({
        data: membros.map((m) => ({ bancaId: nova.id, ...m })),
      });
      return tx.banca.findUniqueOrThrow({ where: { id: nova.id }, include: incluirBanca });
    });
    res.status(201).json(banca);
  })
);

router.put(
  '/pos/bancas/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(atualizarBancaSchema, req.body);
    const membros = dados.membros ? await prepararMembros(dados.membros) : null;

    const banca = await prisma.banca.findUnique({
      where: { id },
      select: { id: true, tipo: true, projetoId: true },
    });
    if (!banca) throw new HttpError(404, 'Banca não encontrada');

    const atualizada = await prisma.$transaction(async (tx) => {
      if (membros) {
        await tx.bancaMembro.deleteMany({ where: { bancaId: id } });
        await tx.bancaMembro.createMany({
          data: membros.map((m) => ({ bancaId: id, ...m })),
        });
      }

      const alterada = await tx.banca.update({
        where: { id },
        data: {
          data: dados.data ? new Date(dados.data) : undefined,
          local: dados.local,
          resultado: dados.resultado,
          parecer: dados.parecer,
        },
        include: incluirBanca,
      });

      const novoStatus = statusDoResultado(banca.tipo, dados.resultado);
      if (novoStatus) {
        await tx.projetoPesquisa.update({
          where: { id: banca.projetoId },
          data: { status: novoStatus },
        });
      }
      return alterada;
    });
    res.json(atualizada);
  })
);

router.delete(
  '/pos/bancas/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const existe = await prisma.banca.count({ where: { id } });
    if (existe === 0) throw new HttpError(404, 'Banca não encontrada');
    await prisma.banca.delete({ where: { id } });
    res.status(204).end();
  })
);

export default router;
