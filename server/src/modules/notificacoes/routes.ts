import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import type { TipoNotificacao } from '../../lib/notificacoes';
// Importar o módulo registra a limpeza periódica dos avisos antigos.
import '../../lib/notificacoes';

const router = Router();

interface NotificacaoDTO {
  id: number;
  tipo: TipoNotificacao;
  titulo: string;
  texto: string;
  link: string | null;
  criadaEm: string;
  lida: boolean;
}

const listarSchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).default(20),
  antesDe: z.coerce.number().int().positive().optional(),
});

function paraDTO(linha: {
  id: number;
  tipo: string;
  titulo: string;
  texto: string;
  link: string | null;
  criadaEm: Date;
  lidaEm: Date | null;
}): NotificacaoDTO {
  return {
    id: linha.id,
    tipo: linha.tipo as TipoNotificacao,
    titulo: linha.titulo,
    texto: linha.texto,
    link: linha.link,
    criadaEm: linha.criadaEm.toISOString(),
    lida: linha.lidaEm !== null,
  };
}

// Lista os avisos do próprio usuário, do mais novo para o mais antigo.
router.get(
  '/notificacoes',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const { limite, antesDe } = validar(listarSchema, req.query);
    const [linhas, naoLidas] = await Promise.all([
      prisma.notificacao.findMany({
        where: { usuarioId: meuId, ...(antesDe !== undefined ? { id: { lt: antesDe } } : {}) },
        orderBy: { id: 'desc' },
        take: limite + 1,
      }),
      prisma.notificacao.count({ where: { usuarioId: meuId, lidaEm: null } }),
    ]);
    const haMais = linhas.length > limite;
    const itens = linhas.slice(0, limite).map(paraDTO);
    res.json({ itens, haMais, naoLidas });
  })
);

router.get(
  '/notificacoes/nao-lidas',
  asyncHandler(async (req, res) => {
    const total = await prisma.notificacao.count({ where: { usuarioId: req.usuario.id, lidaEm: null } });
    res.json({ total });
  })
);

router.post(
  '/notificacoes/lidas',
  asyncHandler(async (req, res) => {
    await prisma.notificacao.updateMany({
      where: { usuarioId: req.usuario.id, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    res.status(204).end();
  })
);

router.post(
  '/notificacoes/:id/lida',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const id = idParam(req);
    const aviso = await prisma.notificacao.findFirst({
      where: { id, usuarioId: meuId },
      select: { id: true, lidaEm: true },
    });
    if (!aviso) {
      throw new HttpError(404, 'Aviso não encontrado');
    }
    if (aviso.lidaEm === null) {
      await prisma.notificacao.update({ where: { id }, data: { lidaEm: new Date() } });
    }
    res.status(204).end();
  })
);

router.delete(
  '/notificacoes/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const apagados = await prisma.notificacao.deleteMany({ where: { id, usuarioId: req.usuario.id } });
    if (apagados.count === 0) {
      throw new HttpError(404, 'Aviso não encontrado');
    }
    res.status(204).end();
  })
);

export default router;
