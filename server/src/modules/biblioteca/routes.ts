import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';

const router = Router();

const DIAS_PADRAO = 14;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Inclusão padrão de empréstimo no formato EmprestimoDTO (sem senhaHash)
const INCLUIR_EMPRESTIMO = {
  livro: { select: { id: true, titulo: true, autor: true, capa: true } },
  usuario: { select: { id: true, nome: true, perfil: true } },
};

// Query string vazia (ex.: ?status=) conta como ausente
function semVazios(q: unknown): Record<string, unknown> {
  const origem = (q ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(origem).filter(([, v]) => v !== ''));
}

// Acrescenta atrasado (ATIVO e devolucaoPrevista anterior a agora)
function paraDTO<T extends { status: string; devolucaoPrevista: Date }>(
  e: T
): T & { atrasado: boolean } {
  return {
    ...e,
    atrasado: e.status === 'ATIVO' && e.devolucaoPrevista.getTime() < Date.now(),
  };
}

// ---------- Livros ----------

const campoTexto = z.string().nullable().optional();

const PREFIXOS_DATA_URL_CAPA = [
  'data:image/jpeg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
];
const MAX_CAPA_ENDERECO = 500;
const MAX_CAPA_DATA_URL = 200_000;

// Normaliza a capa: vazio vira null; endereço http(s) até 500 caracteres ou data URL de imagem até 200.000
function normalizarCapa(capa: string | null | undefined): string | null | undefined {
  if (capa === undefined || capa === null) return capa;
  const limpa = capa.trim();
  if (limpa === '') return null;
  if (limpa.startsWith('http://') || limpa.startsWith('https://')) {
    if (limpa.length <= MAX_CAPA_ENDERECO) return limpa;
    throw new HttpError(400, 'Capa inválida');
  }
  if (PREFIXOS_DATA_URL_CAPA.some((p) => limpa.startsWith(p))) {
    if (limpa.length <= MAX_CAPA_DATA_URL) return limpa;
    throw new HttpError(400, 'Capa inválida');
  }
  throw new HttpError(400, 'Capa inválida');
}

const criarLivroSchema = z.object({
  titulo: z.string().min(1),
  autor: z.string().min(1),
  isbn: campoTexto,
  editora: campoTexto,
  ano: z.number().int().nullable().optional(),
  categoria: campoTexto,
  exemplares: z.number().int().min(0),
  capa: z.string().nullable().optional(),
});

const atualizarLivroSchema = z.object({
  titulo: z.string().min(1).optional(),
  autor: z.string().min(1).optional(),
  isbn: campoTexto,
  editora: campoTexto,
  ano: z.number().int().nullable().optional(),
  categoria: campoTexto,
  exemplares: z.number().int().min(0).optional(),
  capa: z.string().nullable().optional(),
});

const filtroLivrosSchema = z.object({
  busca: z.string().optional(),
});

const criarEmprestimoSchema = z.object({
  livroId: z.number().int().positive(),
  usuarioId: z.number().int().positive(),
  dias: z.number().int().positive().optional(),
});

const filtroEmprestimosSchema = z.object({
  status: z.enum(['ATIVO', 'DEVOLVIDO']).optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
});

router.get(
  '/livros',
  asyncHandler(async (req, res) => {
    const filtro = validar(filtroLivrosSchema, semVazios(req.query));
    const busca = filtro.busca?.trim();
    const where: Prisma.LivroWhereInput | undefined = busca
      ? {
          OR: [
            { titulo: { contains: busca, mode: 'insensitive' } },
            { autor: { contains: busca, mode: 'insensitive' } },
            { categoria: { contains: busca, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const lista = await prisma.livro.findMany({ where, orderBy: { titulo: 'asc' } });
    res.json(lista);
  })
);

router.post(
  '/livros',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(criarLivroSchema, req.body);
    const capa = normalizarCapa(dados.capa);
    const livro = await prisma.livro.create({
      data: { ...dados, capa, disponiveis: dados.exemplares },
    });
    res.status(201).json(livro);
  })
);

router.put(
  '/livros/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dadosRecebidos = validar(atualizarLivroSchema, req.body);
    const dados = { ...dadosRecebidos, capa: normalizarCapa(dadosRecebidos.capa) };
    const livro = await prisma.$transaction(async (tx) => {
      const atual = await tx.livro.findUnique({ where: { id } });
      if (!atual) {
        throw new HttpError(404, 'Livro não encontrado');
      }
      const data: Prisma.LivroUpdateInput = { ...dados };
      if (dados.exemplares !== undefined) {
        data.disponiveis = Math.max(
          0,
          atual.disponiveis + (dados.exemplares - atual.exemplares)
        );
      }
      return tx.livro.update({ where: { id }, data });
    });
    res.json(livro);
  })
);

router.delete(
  '/livros/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await prisma.livro.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Livro não encontrado');
    }
    const ativos = await prisma.emprestimo.count({ where: { livroId: id, status: 'ATIVO' } });
    if (ativos > 0) {
      throw new HttpError(409, 'Livro possui empréstimo ativo');
    }
    await prisma.livro.delete({ where: { id } });
    res.status(204).end();
  })
);

// ---------- Empréstimos ----------

router.get(
  '/emprestimos/meus',
  asyncHandler(async (req, res) => {
    const lista = await prisma.emprestimo.findMany({
      where: { usuarioId: req.usuario.id },
      include: INCLUIR_EMPRESTIMO,
      orderBy: [{ retiradoEm: 'desc' }, { id: 'desc' }],
    });
    res.json(lista.map((e) => paraDTO(e)));
  })
);

router.get(
  '/emprestimos',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const filtro = validar(filtroEmprestimosSchema, semVazios(req.query));
    const lista = await prisma.emprestimo.findMany({
      where: { status: filtro.status, usuarioId: filtro.usuarioId },
      include: INCLUIR_EMPRESTIMO,
      orderBy: [{ retiradoEm: 'desc' }, { id: 'desc' }],
    });
    res.json(lista.map((e) => paraDTO(e)));
  })
);

router.post(
  '/emprestimos',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(criarEmprestimoSchema, req.body);
    const dias = dados.dias ?? DIAS_PADRAO;
    const emprestimo = await prisma.$transaction(async (tx) => {
      const livro = await tx.livro.findUnique({ where: { id: dados.livroId } });
      if (!livro) {
        throw new HttpError(404, 'Livro não encontrado');
      }
      const usuario = await tx.usuario.findUnique({ where: { id: dados.usuarioId } });
      if (!usuario) {
        throw new HttpError(404, 'Usuário não encontrado');
      }
      // Decremento condicional: só desconta se ainda houver exemplar disponível
      const reserva = await tx.livro.updateMany({
        where: { id: livro.id, disponiveis: { gt: 0 } },
        data: { disponiveis: { decrement: 1 } },
      });
      if (reserva.count === 0) {
        throw new HttpError(409, 'Sem exemplares disponíveis');
      }
      return tx.emprestimo.create({
        data: {
          livroId: livro.id,
          usuarioId: usuario.id,
          devolucaoPrevista: new Date(Date.now() + dias * MS_POR_DIA),
        },
        include: INCLUIR_EMPRESTIMO,
      });
    });
    res.status(201).json(paraDTO(emprestimo));
  })
);

router.post(
  '/emprestimos/:id/devolver',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const devolvido = await prisma.$transaction(async (tx) => {
      const atual = await tx.emprestimo.findUnique({ where: { id } });
      if (!atual) {
        throw new HttpError(404, 'Empréstimo não encontrado');
      }
      // Só marca como devolvido se ainda estiver ATIVO
      const marcado = await tx.emprestimo.updateMany({
        where: { id, status: 'ATIVO' },
        data: { status: 'DEVOLVIDO', devolvidoEm: new Date() },
      });
      if (marcado.count === 0) {
        throw new HttpError(409, 'Empréstimo já devolvido');
      }
      await tx.livro.update({
        where: { id: atual.livroId },
        data: { disponiveis: { increment: 1 } },
      });
      return tx.emprestimo.findUniqueOrThrow({ where: { id }, include: INCLUIR_EMPRESTIMO });
    });
    res.json(paraDTO(devolvido));
  })
);

export default router;
