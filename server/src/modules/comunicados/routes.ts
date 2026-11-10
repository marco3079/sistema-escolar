import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import type { UsuarioToken } from '../../lib/auth';

const router = Router();

const incluirComunicado = {
  autor: { select: { nome: true } },
  turma: { select: { codigo: true } },
  curso: { select: { nome: true } },
} satisfies Prisma.ComunicadoInclude;

const comunicadoSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título'),
  corpo: z.string().trim().min(1, 'Informe o corpo do comunicado'),
  publico: z.enum(['TODOS', 'ALUNOS', 'PROFESSORES', 'TURMA', 'CURSO']),
  turmaId: z.number().int().positive().nullable().optional(),
  cursoId: z.number().int().positive().nullable().optional(),
});

// Condições de visibilidade (seção 5.10): ADMIN e SECRETARIA veem tudo.
async function visiveisPara(usuario: UsuarioToken): Promise<Prisma.ComunicadoWhereInput> {
  const { id, perfil, alunoId, professorId } = usuario;
  if (perfil === 'ADMIN' || perfil === 'SECRETARIA') {
    return {};
  }

  const condicoes: Prisma.ComunicadoWhereInput[] = [{ autorId: id }, { publico: 'TODOS' }];

  if (perfil === 'ALUNO') {
    condicoes.push({ publico: 'ALUNOS' });
    if (alunoId !== null) {
      const [inscricoes, matriculas] = await Promise.all([
        prisma.inscricao.findMany({
          where: { status: { not: 'TRANCADO' }, matricula: { alunoId } },
          select: { turmaId: true },
        }),
        prisma.matricula.findMany({ where: { alunoId }, select: { cursoId: true } }),
      ]);
      condicoes.push(
        { publico: 'TURMA', turmaId: { in: inscricoes.map((i) => i.turmaId) } },
        { publico: 'CURSO', cursoId: { in: matriculas.map((m) => m.cursoId) } }
      );
    }
  } else if (perfil === 'PROFESSOR') {
    condicoes.push({ publico: 'PROFESSORES' });
    if (professorId !== null) {
      const turmas = await prisma.turma.findMany({
        where: { professorId },
        select: { id: true, disciplina: { select: { cursoId: true } } },
      });
      const cursoIds = [...new Set(turmas.map((t) => t.disciplina.cursoId))];
      condicoes.push(
        { publico: 'TURMA', turmaId: { in: turmas.map((t) => t.id) } },
        { publico: 'CURSO', cursoId: { in: cursoIds } }
      );
    }
  }

  return { OR: condicoes };
}

router.get(
  '/comunicados',
  asyncHandler(async (req, res) => {
    const where = await visiveisPara(req.usuario);
    const lista = await prisma.comunicado.findMany({
      where,
      orderBy: [{ publicadoEm: 'desc' }, { id: 'desc' }],
      include: {
        ...incluirComunicado,
        leituras: { where: { usuarioId: req.usuario.id } },
      },
    });
    res.json(lista.map(({ leituras, ...comunicado }) => ({ ...comunicado, lido: leituras.length > 0 })));
  })
);

router.post(
  '/comunicados',
  asyncHandler(async (req, res) => {
    const dados = validar(comunicadoSchema, req.body);
    const { publico } = dados;
    const turmaId = publico === 'TURMA' ? (dados.turmaId ?? null) : null;
    const cursoId = publico === 'CURSO' ? (dados.cursoId ?? null) : null;

    if (publico === 'TURMA' && turmaId === null) {
      throw new HttpError(400, 'Informe a turma do comunicado');
    }
    if (publico === 'CURSO' && cursoId === null) {
      throw new HttpError(400, 'Informe o curso do comunicado');
    }

    const { id, perfil, professorId } = req.usuario;
    if (perfil === 'PROFESSOR') {
      if (publico !== 'TURMA' || turmaId === null || professorId === null) {
        throw new HttpError(403, 'Professor só pode enviar comunicado para turma');
      }
    } else if (perfil !== 'ADMIN' && perfil !== 'SECRETARIA') {
      throw new HttpError(403, 'Sem permissão');
    }

    if (turmaId !== null) {
      const turma = await prisma.turma.findUnique({
        where: { id: turmaId },
        select: { professorId: true },
      });
      if (!turma) {
        throw new HttpError(404, 'Turma não encontrada');
      }
      if (perfil === 'PROFESSOR' && turma.professorId !== professorId) {
        throw new HttpError(403, 'Você não é professor desta turma');
      }
    }

    if (cursoId !== null) {
      const curso = await prisma.curso.findUnique({ where: { id: cursoId }, select: { id: true } });
      if (!curso) {
        throw new HttpError(404, 'Curso não encontrado');
      }
    }

    const criado = await prisma.comunicado.create({
      data: {
        titulo: dados.titulo,
        corpo: dados.corpo,
        publico,
        autorId: id,
        turmaId,
        cursoId,
      },
      include: incluirComunicado,
    });
    res.status(201).json({ ...criado, lido: false });
  })
);

router.delete(
  '/comunicados/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const comunicado = await prisma.comunicado.findUnique({
      where: { id },
      select: { id: true, autorId: true },
    });
    if (!comunicado) {
      throw new HttpError(404, 'Comunicado não encontrado');
    }
    if (req.usuario.perfil !== 'ADMIN' && comunicado.autorId !== req.usuario.id) {
      throw new HttpError(403, 'Sem permissão');
    }
    await prisma.comunicado.delete({ where: { id } });
    res.status(204).end();
  })
);

router.post(
  '/comunicados/:id/ler',
  asyncHandler(async (req, res) => {
    const comunicadoId = idParam(req);
    const usuarioId = req.usuario.id;
    const visivel = await prisma.comunicado.findFirst({
      where: { AND: [{ id: comunicadoId }, await visiveisPara(req.usuario)] },
      select: { id: true },
    });
    if (!visivel) {
      throw new HttpError(404, 'Comunicado não encontrado');
    }
    await prisma.comunicadoLeitura.upsert({
      where: { comunicadoId_usuarioId: { comunicadoId, usuarioId } },
      create: { comunicadoId, usuarioId },
      update: {},
    });
    res.status(204).end();
  })
);

export default router;
