import { Router, type Request } from 'express';
import type { ForumComentario, Perfil, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { notificar } from '../../lib/notificacoes';

const router = Router();

type Voto = 1 | -1 | 0;

interface UsuarioResumo {
  id: number;
  nome: string;
  perfil: string;
  foto: string | null;
}

const incluirPublicacao = {
  comunidade: { select: { nome: true, slug: true, cor: true } },
} satisfies Prisma.ForumPublicacaoInclude;

type PublicacaoLinha = Prisma.ForumPublicacaoGetPayload<{ include: typeof incluirPublicacao }>;

const PREFIXOS_IMAGEM = ['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,'];
const MAX_CARACTERES_IMAGEM = 200_000;

// ---------- Funções auxiliares ----------

function gerarSlug(nome: string): string {
  const slug = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (!slug) {
    throw new HttpError(400, 'Informe um nome com letras ou números');
  }
  return slug;
}

// Validação de imagem: null/vazio, ou data URL JPEG, PNG ou WebP de até 200.000 caracteres.
function validarImagem(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  if (
    typeof valor !== 'string' ||
    valor.length > MAX_CARACTERES_IMAGEM ||
    !PREFIXOS_IMAGEM.some((prefixo) => valor.startsWith(prefixo))
  ) {
    throw new HttpError(400, 'Imagem inválida: use JPEG, PNG ou WebP com até 200.000 caracteres');
  }
  return valor;
}

function ehModerador(req: Request): boolean {
  return req.usuario.perfil === 'ADMIN' || req.usuario.perfil === 'SECRETARIA';
}

function usuarioResumo(u: { id: number; nome: string; perfil: Perfil; foto: string | null }): UsuarioResumo {
  return { id: u.id, nome: u.nome, perfil: u.perfil, foto: u.foto };
}

// Os modelos de fórum guardam só autorId (sem relação), então os nomes vêm numa consulta em lote.
async function carregarAutores(ids: number[]): Promise<Map<number, UsuarioResumo>> {
  const mapa = new Map<number, UsuarioResumo>();
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) {
    return mapa;
  }
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: unicos } },
    select: { id: true, nome: true, perfil: true, foto: true },
  });
  for (const u of usuarios) {
    mapa.set(u.id, usuarioResumo(u));
  }
  return mapa;
}

function autorDe(mapa: Map<number, UsuarioResumo>, id: number): UsuarioResumo {
  return mapa.get(id) ?? { id, nome: 'Removido', perfil: '', foto: null };
}

async function mapaVotosPublicacoes(usuarioId: number, ids: number[]): Promise<Map<number, Voto>> {
  const mapa = new Map<number, Voto>();
  if (ids.length === 0) {
    return mapa;
  }
  const votos = await prisma.forumVoto.findMany({
    where: { usuarioId, publicacaoId: { in: ids } },
    select: { publicacaoId: true, valor: true },
  });
  for (const v of votos) {
    if (v.publicacaoId !== null) {
      mapa.set(v.publicacaoId, v.valor as Voto);
    }
  }
  return mapa;
}

async function mapaVotosComentarios(usuarioId: number, ids: number[]): Promise<Map<number, Voto>> {
  const mapa = new Map<number, Voto>();
  if (ids.length === 0) {
    return mapa;
  }
  const votos = await prisma.forumVoto.findMany({
    where: { usuarioId, comentarioId: { in: ids } },
    select: { comentarioId: true, valor: true },
  });
  for (const v of votos) {
    if (v.comentarioId !== null) {
      mapa.set(v.comentarioId, v.valor as Voto);
    }
  }
  return mapa;
}

function paraComunidadeDTO(
  c: { id: number; nome: string; slug: string; descricao: string | null; cor: string; criadoEm: Date },
  publicacoes: number
) {
  return {
    id: c.id,
    nome: c.nome,
    slug: c.slug,
    descricao: c.descricao,
    cor: c.cor,
    publicacoes,
    criadoEm: c.criadoEm,
  };
}

function paraPublicacaoDTO(p: PublicacaoLinha, autor: UsuarioResumo, req: Request, meuVoto: Voto) {
  const euSou = p.autorId === req.usuario.id;
  const moderador = ehModerador(req);
  return {
    id: p.id,
    titulo: p.titulo,
    corpo: p.corpo,
    imagem: p.imagem,
    fixada: p.fixada,
    fechada: p.fechada,
    pontos: p.pontos,
    comentarios: p.comentarios,
    meuVoto,
    criadoEm: p.criadoEm,
    editadoEm: p.editadoEm,
    autor,
    comunidade: { nome: p.comunidade.nome, slug: p.comunidade.slug, cor: p.comunidade.cor },
    posso: {
      editar: euSou,
      excluir: euSou || moderador,
      // O professor modera as próprias publicações.
      moderar: moderador || (euSou && req.usuario.perfil === 'PROFESSOR'),
    },
  };
}

function paraComentarioDTO(c: ForumComentario, autor: UsuarioResumo, req: Request, meuVoto: Voto) {
  const euSou = c.autorId === req.usuario.id;
  return {
    id: c.id,
    paiId: c.paiId,
    corpo: c.removido ? '[comentário removido]' : c.corpo,
    removido: c.removido,
    pontos: c.pontos,
    meuVoto,
    criadoEm: c.criadoEm,
    editadoEm: c.editadoEm,
    autor: c.removido ? { id: autor.id, nome: 'Removido', perfil: autor.perfil, foto: null } : autor,
    posso: {
      editar: !c.removido && euSou,
      excluir: !c.removido && (euSou || ehModerador(req)),
    },
  };
}

async function montarPublicacoes(linhas: PublicacaoLinha[], req: Request) {
  const [autores, votos] = await Promise.all([
    carregarAutores(linhas.map((l) => l.autorId)),
    mapaVotosPublicacoes(req.usuario.id, linhas.map((l) => l.id)),
  ]);
  return linhas.map((l) => paraPublicacaoDTO(l, autorDe(autores, l.autorId), req, votos.get(l.id) ?? 0));
}

// Grava (cria, altera ou apaga) o voto do usuário e devolve a soma atual dos votos do alvo.
async function gravarVoto(
  tx: Prisma.TransactionClient,
  dono: { publicacaoId: number } | { comentarioId: number },
  usuarioId: number,
  valor: Voto
): Promise<number> {
  if (valor === 0) {
    await tx.forumVoto.deleteMany({ where: { usuarioId, ...dono } });
  } else {
    const atualizados = await tx.forumVoto.updateMany({ where: { usuarioId, ...dono }, data: { valor } });
    if (atualizados.count === 0) {
      await tx.forumVoto.create({ data: { usuarioId, valor, ...dono } });
    }
  }
  const soma = await tx.forumVoto.aggregate({ where: dono, _sum: { valor: true } });
  return soma._sum.valor ?? 0;
}

function lerLimite(bruto: string | undefined): number {
  if (bruto === undefined || bruto === '') {
    return 20;
  }
  if (!/^\d+$/.test(bruto) || Number(bruto) < 1) {
    throw new HttpError(400, 'Parâmetro limite inválido');
  }
  return Math.min(Number(bruto), 50);
}

function lerInteiro(bruto: string | undefined, nome: string): number | undefined {
  if (bruto === undefined || bruto === '') {
    return undefined;
  }
  if (!/^\d+$/.test(bruto)) {
    throw new HttpError(400, `Parâmetro ${nome} inválido`);
  }
  return Number(bruto);
}

// ---------- Schemas ----------

const comunidadeSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da comunidade'),
  descricao: z.string().trim().nullable().optional(),
  cor: z.enum(['azul', 'roxo', 'verde', 'laranja']).optional(),
});

const publicacaoCriarSchema = z.object({
  comunidade: z.string().trim().min(1, 'Informe a comunidade'),
  titulo: z.string().trim().min(3, 'O título deve ter de 3 a 160 caracteres').max(160, 'O título deve ter de 3 a 160 caracteres'),
  corpo: z.string().trim().max(10000, 'O corpo tem no máximo 10.000 caracteres'),
  imagem: z.unknown().optional(),
});

const publicacaoAtualizarSchema = z.object({
  titulo: z.string().trim().min(3, 'O título deve ter de 3 a 160 caracteres').max(160, 'O título deve ter de 3 a 160 caracteres').optional(),
  corpo: z.string().trim().max(10000, 'O corpo tem no máximo 10.000 caracteres').optional(),
  imagem: z.unknown().optional(),
  fixada: z.boolean().optional(),
  fechada: z.boolean().optional(),
});

const comentarioSchema = z.object({
  corpo: z.string().trim().min(1, 'Informe o comentário').max(4000, 'O comentário tem no máximo 4.000 caracteres'),
  paiId: z.number().int().positive().nullable().optional(),
});

const comentarioEditarSchema = z.object({
  corpo: z.string().trim().min(1, 'Informe o comentário').max(4000, 'O comentário tem no máximo 4.000 caracteres'),
});

const votoSchema = z.object({
  valor: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

const listagemSchema = z.object({
  comunidade: z.string().optional(),
  ordem: z.enum(['alta', 'novas', 'votadas']).optional(),
  busca: z.string().optional(),
  autorId: z.string().optional(),
  antesDe: z.string().optional(),
  limite: z.string().optional(),
});

// ---------- Comunidades ----------

router.get(
  '/forum/comunidades',
  asyncHandler(async (_req, res) => {
    const [lista, contagens] = await Promise.all([
      prisma.forumComunidade.findMany({ orderBy: { id: 'asc' } }),
      prisma.forumPublicacao.groupBy({
        by: ['comunidadeId'],
        where: { removida: false },
        _count: { _all: true },
      }),
    ]);
    const porComunidade = new Map(contagens.map((c) => [c.comunidadeId, c._count._all]));
    const dtos = lista
      .map((c) => paraComunidadeDTO(c, porComunidade.get(c.id) ?? 0))
      .sort((a, b) => b.publicacoes - a.publicacoes || a.nome.localeCompare(b.nome, 'pt-BR'));
    res.json(dtos);
  })
);

router.post(
  '/forum/comunidades',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const dados = validar(comunidadeSchema, req.body);
    const slug = gerarSlug(dados.nome);
    const criada = await prisma.forumComunidade.create({
      data: {
        nome: dados.nome,
        slug,
        descricao: dados.descricao ? dados.descricao : null,
        cor: dados.cor ?? 'azul',
        criadoPorId: req.usuario.id,
      },
    });
    res.status(201).json(paraComunidadeDTO(criada, 0));
  })
);

// ---------- Publicações ----------

router.get(
  '/forum/publicacoes',
  asyncHandler(async (req, res) => {
    const q = validar(listagemSchema, req.query);
    const ordem = q.ordem ?? 'alta';
    const limite = lerLimite(q.limite);
    const antesDe = lerInteiro(q.antesDe, 'antesDe');
    const autorId = lerInteiro(q.autorId, 'autorId');
    const busca = q.busca?.trim() ?? '';

    const where: Prisma.ForumPublicacaoWhereInput = { removida: false };

    let fixadasPrimeiro = false;
    if (q.comunidade !== undefined && q.comunidade.trim() !== '') {
      const comunidade = await prisma.forumComunidade.findUnique({
        where: { slug: q.comunidade.trim() },
        select: { id: true },
      });
      if (!comunidade) {
        throw new HttpError(404, 'Comunidade não encontrada');
      }
      where.comunidadeId = comunidade.id;
      fixadasPrimeiro = true;
    }
    if (autorId !== undefined) {
      where.autorId = autorId;
    }
    if (busca !== '') {
      where.OR = [
        { titulo: { contains: busca, mode: 'insensitive' } },
        { corpo: { contains: busca, mode: 'insensitive' } },
      ];
    }

    if (ordem === 'alta') {
      // "Em alta": pontuação calculada em memória sobre as 200 publicações mais recentes do filtro.
      const recentes = await prisma.forumPublicacao.findMany({
        where,
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        include: incluirPublicacao,
        take: 200,
      });
      const agora = Date.now();
      const pontuadas = recentes.map((p) => {
        const horas = (agora - p.criadoEm.getTime()) / 3600000;
        return { p, score: p.pontos / Math.pow(horas + 2, 1.5) };
      });
      pontuadas.sort(
        (a, b) =>
          (fixadasPrimeiro ? Number(b.p.fixada) - Number(a.p.fixada) : 0) ||
          b.score - a.score ||
          b.p.id - a.p.id
      );
      let inicio = 0;
      if (antesDe !== undefined) {
        const indice = pontuadas.findIndex((x) => x.p.id === antesDe);
        inicio = indice >= 0 ? indice + 1 : 0;
      }
      const fatia = pontuadas.slice(inicio, inicio + limite);
      const haMais = pontuadas.length > inicio + limite;
      const pagina = fatia.map((x) => x.p);
      res.json({ itens: await montarPublicacoes(pagina, req), haMais });
      return;
    }

    const orderBy: Prisma.ForumPublicacaoOrderByWithRelationInput[] = [];
    if (fixadasPrimeiro) {
      orderBy.push({ fixada: 'desc' });
    }
    if (ordem === 'novas') {
      orderBy.push({ criadoEm: 'desc' }, { id: 'desc' });
    } else {
      orderBy.push({ pontos: 'desc' }, { id: 'desc' });
    }

    const linhas = await prisma.forumPublicacao.findMany({
      where,
      orderBy,
      include: incluirPublicacao,
      take: limite + 1,
      ...(antesDe !== undefined ? { cursor: { id: antesDe }, skip: 1 } : {}),
    });
    const haMais = linhas.length > limite;
    const pagina = linhas.slice(0, limite);
    res.json({ itens: await montarPublicacoes(pagina, req), haMais });
  })
);

router.get(
  '/forum/publicacoes/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const p = await prisma.forumPublicacao.findUnique({ where: { id }, include: incluirPublicacao });
    if (!p || p.removida) {
      throw new HttpError(404, 'Publicação não encontrada');
    }

    const comentarios = await prisma.forumComentario.findMany({
      where: { publicacaoId: id },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    const idsComentarios = comentarios.map((c) => c.id);
    const [autores, votoPublicacao, votosComentarios] = await Promise.all([
      carregarAutores([p.autorId, ...comentarios.map((c) => c.autorId)]),
      mapaVotosPublicacoes(req.usuario.id, [id]),
      mapaVotosComentarios(req.usuario.id, idsComentarios),
    ]);

    const dto = paraPublicacaoDTO(p, autorDe(autores, p.autorId), req, votoPublicacao.get(id) ?? 0);
    res.json({
      ...dto,
      comentariosLista: comentarios.map((c) =>
        paraComentarioDTO(c, autorDe(autores, c.autorId), req, votosComentarios.get(c.id) ?? 0)
      ),
    });
  })
);

router.post(
  '/forum/publicacoes',
  asyncHandler(async (req, res) => {
    const dados = validar(publicacaoCriarSchema, req.body);
    const imagem = validarImagem(dados.imagem);
    const comunidade = await prisma.forumComunidade.findUnique({
      where: { slug: dados.comunidade },
      select: { id: true },
    });
    if (!comunidade) {
      throw new HttpError(404, 'Comunidade não encontrada');
    }
    const criada = await prisma.forumPublicacao.create({
      data: {
        comunidadeId: comunidade.id,
        autorId: req.usuario.id,
        titulo: dados.titulo,
        corpo: dados.corpo,
        imagem,
      },
      include: incluirPublicacao,
    });
    const autores = await carregarAutores([req.usuario.id]);
    res.status(201).json(paraPublicacaoDTO(criada, autorDe(autores, req.usuario.id), req, 0));
  })
);

router.put(
  '/forum/publicacoes/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(publicacaoAtualizarSchema, req.body ?? {});
    const bruto = req.body as Record<string, unknown>;
    const camposAutor = ['titulo', 'corpo', 'imagem'].filter((c) => c in bruto);
    const camposModerador = ['fixada', 'fechada'].filter((c) => c in bruto);

    const atual = await prisma.forumPublicacao.findUnique({
      where: { id },
      select: { autorId: true, removida: true },
    });
    if (!atual || atual.removida) {
      throw new HttpError(404, 'Publicação não encontrada');
    }

    const euSou = atual.autorId === req.usuario.id;
    const podeModerar = ehModerador(req) || (euSou && req.usuario.perfil === 'PROFESSOR');
    if (camposAutor.length > 0 && !euSou) {
      throw new HttpError(403, 'Só o autor pode alterar título, texto ou imagem');
    }
    if (camposModerador.length > 0 && !podeModerar) {
      throw new HttpError(403, 'Sem permissão para fixar ou fechar esta publicação');
    }

    const data: Prisma.ForumPublicacaoUpdateInput = {};
    if (dados.titulo !== undefined) data.titulo = dados.titulo;
    if (dados.corpo !== undefined) data.corpo = dados.corpo;
    if ('imagem' in bruto) data.imagem = validarImagem(dados.imagem);
    if (dados.fixada !== undefined) data.fixada = dados.fixada;
    if (dados.fechada !== undefined) data.fechada = dados.fechada;
    if (camposAutor.length > 0) data.editadoEm = new Date();

    const atualizada = await prisma.forumPublicacao.update({
      where: { id },
      data,
      include: incluirPublicacao,
    });
    const [dto] = await montarPublicacoes([atualizada], req);
    res.json(dto);
  })
);

router.delete(
  '/forum/publicacoes/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const p = await prisma.forumPublicacao.findUnique({
      where: { id },
      select: { autorId: true, removida: true },
    });
    if (!p || p.removida) {
      throw new HttpError(404, 'Publicação não encontrada');
    }
    if (p.autorId !== req.usuario.id && !ehModerador(req)) {
      throw new HttpError(403, 'Sem permissão');
    }
    await prisma.forumPublicacao.update({ where: { id }, data: { removida: true } });
    res.status(204).end();
  })
);

router.post(
  '/forum/publicacoes/:id/voto',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const { valor } = validar(votoSchema, req.body);
    const p = await prisma.forumPublicacao.findUnique({ where: { id }, select: { removida: true } });
    if (!p || p.removida) {
      throw new HttpError(404, 'Publicação não encontrada');
    }
    const pontos = await prisma.$transaction(async (tx) => {
      const soma = await gravarVoto(tx, { publicacaoId: id }, req.usuario.id, valor);
      await tx.forumPublicacao.update({ where: { id }, data: { pontos: soma } });
      return soma;
    });
    res.json({ pontos, meuVoto: valor });
  })
);

// ---------- Comentários ----------

router.post(
  '/forum/publicacoes/:id/comentarios',
  asyncHandler(async (req, res) => {
    const publicacaoId = idParam(req);
    const dados = validar(comentarioSchema, req.body);
    const p = await prisma.forumPublicacao.findUnique({
      where: { id: publicacaoId },
      select: { id: true, fechada: true, removida: true, titulo: true, autorId: true },
    });
    if (!p) {
      throw new HttpError(404, 'Publicação não encontrada');
    }
    if (p.removida) {
      throw new HttpError(409, 'Publicação removida');
    }
    if (p.fechada) {
      throw new HttpError(409, 'Publicação fechada para comentários');
    }

    const paiId = dados.paiId ?? null;
    let autorDoPaiId: number | null = null;
    if (paiId !== null) {
      const pai = await prisma.forumComentario.findFirst({
        where: { id: paiId, publicacaoId },
        select: { id: true, autorId: true },
      });
      if (!pai) {
        throw new HttpError(400, 'Comentário respondido inválido para esta publicação');
      }
      autorDoPaiId = pai.autorId;
    }

    const criado = await prisma.$transaction(async (tx) => {
      const comentario = await tx.forumComentario.create({
        data: { publicacaoId, autorId: req.usuario.id, paiId, corpo: dados.corpo },
      });
      await tx.forumPublicacao.update({
        where: { id: publicacaoId },
        data: { comentarios: { increment: 1 } },
      });
      return comentario;
    });

    const autores = await carregarAutores([req.usuario.id]);
    // Aviso no sino: o autor da publicação e, em resposta, o autor do comentário pai (menos quem comentou).
    const avisados = [p.autorId, autorDoPaiId].filter(
      (uid): uid is number => uid !== null && uid !== req.usuario.id
    );
    if (avisados.length > 0) {
      notificar(avisados, {
        tipo: 'FORUM',
        titulo: `${autorDe(autores, req.usuario.id).nome} comentou em: ${p.titulo}`,
        link: `/forum/p/${publicacaoId}`,
      });
    }
    res.status(201).json(paraComentarioDTO(criado, autorDe(autores, req.usuario.id), req, 0));
  })
);

router.put(
  '/forum/comentarios/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(comentarioEditarSchema, req.body);
    const c = await prisma.forumComentario.findUnique({
      where: { id },
      select: { autorId: true, removido: true, publicacao: { select: { removida: true } } },
    });
    if (!c || c.removido || c.publicacao.removida) {
      throw new HttpError(404, 'Comentário não encontrado');
    }
    if (c.autorId !== req.usuario.id) {
      throw new HttpError(403, 'Só o autor pode editar o comentário');
    }
    const atualizado = await prisma.forumComentario.update({
      where: { id },
      data: { corpo: dados.corpo, editadoEm: new Date() },
    });
    const [autores, votos] = await Promise.all([
      carregarAutores([atualizado.autorId]),
      mapaVotosComentarios(req.usuario.id, [id]),
    ]);
    res.json(paraComentarioDTO(atualizado, autorDe(autores, atualizado.autorId), req, votos.get(id) ?? 0));
  })
);

router.delete(
  '/forum/comentarios/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const c = await prisma.forumComentario.findUnique({
      where: { id },
      select: {
        autorId: true,
        publicacaoId: true,
        removido: true,
        publicacao: { select: { removida: true } },
      },
    });
    if (!c || c.removido || c.publicacao.removida) {
      throw new HttpError(404, 'Comentário não encontrado');
    }
    if (c.autorId !== req.usuario.id && !ehModerador(req)) {
      throw new HttpError(403, 'Sem permissão');
    }
    await prisma.$transaction(async (tx) => {
      // Só desconta do contador se o comentário ainda não estava removido (evita dupla contagem).
      const marcados = await tx.forumComentario.updateMany({
        where: { id, removido: false },
        data: { removido: true },
      });
      if (marcados.count === 1) {
        await tx.forumPublicacao.update({
          where: { id: c.publicacaoId },
          data: { comentarios: { decrement: 1 } },
        });
      }
    });
    res.status(204).end();
  })
);

router.post(
  '/forum/comentarios/:id/voto',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const { valor } = validar(votoSchema, req.body);
    const c = await prisma.forumComentario.findUnique({
      where: { id },
      select: { removido: true, publicacao: { select: { removida: true } } },
    });
    if (!c || c.removido || c.publicacao.removida) {
      throw new HttpError(404, 'Comentário não encontrado');
    }
    const pontos = await prisma.$transaction(async (tx) => {
      const soma = await gravarVoto(tx, { comentarioId: id }, req.usuario.id, valor);
      await tx.forumComentario.update({ where: { id }, data: { pontos: soma } });
      return soma;
    });
    res.json({ pontos, meuVoto: valor });
  })
);

export default router;
