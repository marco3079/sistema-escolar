import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { validarImagem } from '../conquistas/imagem';
import { marcarDigitando, marcarPresenca, pararDeDigitar, permitirEnvio } from './estado';
import {
  BaseConversas,
  carregarBase,
  contarNaoLidas,
  conversaMudou,
  ConversaChat,
  detalheConversa,
  filtroDeContatos,
  iso,
  leituraDaConversa,
  leituraDos,
  montarConversas,
  montarMensagens,
  participacaoAtiva,
  pessoa,
  usuariosPorId,
} from './comum';

const router = Router();

// Respostas do chat nunca são guardadas em cache (a sincronização muda a cada consulta).
router.use('/chat', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ---------- Esquemas ----------

const buscaSchema = z.object({
  busca: z.string().max(80).optional(),
});

const criarConversaSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('INDIVIDUAL'),
    usuarioId: z.number().int().positive(),
  }),
  z.object({
    tipo: z.literal('GRUPO'),
    nome: z.string().trim().min(2, 'O nome do grupo tem de 2 a 60 caracteres').max(60, 'O nome do grupo tem de 2 a 60 caracteres'),
    participantes: z.array(z.number().int().positive()).max(100),
    foto: z.unknown().optional(),
  }),
]);

const editarConversaSchema = z.object({
  nome: z.string().trim().min(2, 'O nome do grupo tem de 2 a 60 caracteres').max(60, 'O nome do grupo tem de 2 a 60 caracteres').optional(),
  foto: z.unknown().optional(),
});

const adicionarParticipantesSchema = z.object({
  usuarioIds: z.array(z.number().int().positive()).min(1).max(99),
});

const listarMensagensSchema = z.object({
  antesDe: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().min(1).max(50).default(30),
});

const sincronizarSchema = z.object({
  desde: z.string().optional(),
  conversaId: z.coerce.number().int().positive().optional(),
});

const enviarMensagemSchema = z.object({
  texto: z.string().optional().nullable(),
  imagem: z.unknown().optional(),
  respostaAId: z.number().int().positive().nullish(),
});

// ---------- Contatos e conversas ----------

router.get(
  '/chat/contatos',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const { busca } = validar(buscaSchema, req.query);
    const termo = busca?.trim() ?? '';
    const lista = await prisma.usuario.findMany({
      where: {
        AND: [
          { ativo: true },
          { id: { not: meuId } },
          filtroDeContatos(req.usuario),
          ...(termo ? [{ nome: { contains: termo, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: { id: true, nome: true, perfil: true, foto: true, ativo: true },
      orderBy: { nome: 'asc' },
      take: 40,
    });
    res.json(lista.map((u) => pessoa(u)));
  })
);

router.get(
  '/chat/conversas',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const base = await carregarBase(meuId);
    res.json(montarConversas(base, meuId));
  })
);

router.post(
  '/chat/conversas',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const dados = validar(criarConversaSchema, req.body);

    if (dados.tipo === 'INDIVIDUAL') {
      const outroId = dados.usuarioId;
      if (outroId === meuId) {
        throw new HttpError(400, 'Não é possível abrir uma conversa com você mesmo');
      }
      const outro = await prisma.usuario.findFirst({
        where: { AND: [{ id: outroId, ativo: true }, filtroDeContatos(req.usuario)] },
        select: { id: true },
      });
      if (!outro) {
        throw new HttpError(404, 'Usuário não encontrado');
      }
      const chave = [meuId, outroId].sort((a, b) => a - b).join(':');
      const existente = await prisma.chatConversa.findUnique({ where: { chaveIndividual: chave }, select: { id: true } });
      if (existente) {
        res.status(200).json(await detalheConversa(meuId, existente.id));
        return;
      }
      const agora = new Date();
      const criada = await prisma.chatConversa.create({
        data: {
          tipo: 'INDIVIDUAL',
          chaveIndividual: chave,
          criadoPorId: meuId,
          criadaEm: agora,
          atualizadaEm: agora,
          participantes: {
            create: [
              { usuarioId: meuId, entrouEm: agora },
              { usuarioId: outroId, entrouEm: agora },
            ],
          },
        },
        select: { id: true },
      });
      res.status(201).json(await detalheConversa(meuId, criada.id));
      return;
    }

    // GRUPO: responsáveis não criam grupos nem entram neles (só conversam individualmente com a equipe e professores).
    if (req.usuario.perfil === 'RESPONSAVEL') {
      throw new HttpError(403, 'Responsáveis não podem criar grupos');
    }
    const ids = [...new Set(dados.participantes)].filter((id) => id !== meuId);
    if (ids.length < 1 || ids.length > 99) {
      throw new HttpError(400, 'Escolha de 1 a 99 outras pessoas para o grupo');
    }
    const ativos = await prisma.usuario.findMany({
      where: { id: { in: ids }, ativo: true, perfil: { not: 'RESPONSAVEL' } },
      select: { id: true },
    });
    if (ativos.length !== ids.length) {
      throw new HttpError(400, 'Alguma pessoa escolhida não está disponível');
    }
    const foto = validarImagem(dados.foto, { aceitaEndereco: false });
    const usuarios = await usuariosPorId([meuId]);
    const eu = usuarios.get(meuId);
    const agora = new Date();

    const criado = await prisma.$transaction(async (tx) => {
      const conversa = await tx.chatConversa.create({
        data: {
          tipo: 'GRUPO',
          nome: dados.nome,
          foto,
          criadoPorId: meuId,
          criadaEm: agora,
          atualizadaEm: agora,
          participantes: {
            create: [
              { usuarioId: meuId, admin: true, entrouEm: agora },
              ...ids.map((usuarioId) => ({ usuarioId, admin: false, entrouEm: agora })),
            ],
          },
        },
        select: { id: true },
      });
      await tx.chatMensagem.create({
        data: {
          conversaId: conversa.id,
          autorId: meuId,
          texto: `${eu?.nome ?? 'Alguém'} criou o grupo`,
          sistema: true,
          criadaEm: agora,
        },
      });
      return conversa;
    });
    res.status(201).json(await detalheConversa(meuId, criado.id));
  })
);

router.get(
  '/chat/conversas/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    res.json(await detalheConversa(req.usuario.id, id));
  })
);

router.put(
  '/chat/conversas/:id',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const id = idParam(req);
    const dados = validar(editarConversaSchema, req.body);
    const minha = await participacaoAtiva(id, meuId);
    const conversa = await prisma.chatConversa.findUnique({ where: { id }, select: { tipo: true } });
    if (!conversa) {
      throw new HttpError(404, 'Conversa não encontrada');
    }
    if (conversa.tipo !== 'GRUPO') {
      throw new HttpError(400, 'Só grupos podem ser alterados');
    }
    if (!minha.admin) {
      throw new HttpError(403, 'Só administradores do grupo podem alterar o grupo');
    }
    const alteracoes: Prisma.ChatConversaUpdateInput = { atualizadaEm: new Date() };
    if (dados.nome !== undefined) {
      alteracoes.nome = dados.nome;
    }
    if (dados.foto !== undefined) {
      alteracoes.foto = validarImagem(dados.foto, { aceitaEndereco: false });
    }
    await prisma.chatConversa.update({ where: { id }, data: alteracoes });
    res.json(await detalheConversa(meuId, id));
  })
);

router.post(
  '/chat/conversas/:id/participantes',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const id = idParam(req);
    const dados = validar(adicionarParticipantesSchema, req.body);
    const minha = await participacaoAtiva(id, meuId);
    const conversa = await prisma.chatConversa.findUnique({ where: { id }, select: { tipo: true } });
    if (!conversa) {
      throw new HttpError(404, 'Conversa não encontrada');
    }
    if (conversa.tipo !== 'GRUPO') {
      throw new HttpError(400, 'Só grupos recebem novas pessoas');
    }
    if (!minha.admin) {
      throw new HttpError(403, 'Só administradores do grupo podem adicionar pessoas');
    }

    const ids = [...new Set(dados.usuarioIds)];
    const existentes = await prisma.chatParticipante.findMany({
      where: { conversaId: id, usuarioId: { in: ids } },
      select: { usuarioId: true, saiuEm: true },
    });
    const jaAtivos = new Set(existentes.filter((e) => e.saiuEm === null).map((e) => e.usuarioId));
    const aAdicionar = ids.filter((uid) => !jaAtivos.has(uid));

    if (aAdicionar.length > 0) {
      const ativosNoGrupo = await prisma.chatParticipante.count({ where: { conversaId: id, saiuEm: null } });
      if (ativosNoGrupo + aAdicionar.length > 100) {
        throw new HttpError(400, 'O grupo pode ter no máximo 100 participantes');
      }
      const validos = await prisma.usuario.findMany({
        where: { id: { in: aAdicionar }, ativo: true, perfil: { not: 'RESPONSAVEL' } },
        select: { id: true },
      });
      if (validos.length !== aAdicionar.length) {
        throw new HttpError(400, 'Alguma pessoa escolhida não está disponível');
      }
      const nomes = await usuariosPorId([meuId, ...aAdicionar]);
      const jaExistiam = new Set(existentes.map((e) => e.usuarioId));
      const agora = new Date();

      await prisma.$transaction(async (tx) => {
        for (const uid of aAdicionar) {
          if (jaExistiam.has(uid)) {
            // Quem já saiu volta como se entrasse agora: não vê o que foi trocado enquanto esteve fora.
            await tx.chatParticipante.update({
              where: { conversaId_usuarioId: { conversaId: id, usuarioId: uid } },
              data: {
                saiuEm: null,
                admin: false,
                entrouEm: agora,
                ultimaLeituraEm: agora,
                ultimaEntregaEm: agora,
              },
            });
          } else {
            await tx.chatParticipante.create({
              data: { conversaId: id, usuarioId: uid, admin: false, entrouEm: agora },
            });
          }
        }
        const lista = aAdicionar.map((uid) => nomes.get(uid)?.nome ?? '').join(', ');
        await tx.chatMensagem.create({
          data: {
            conversaId: id,
            autorId: meuId,
            texto: `${nomes.get(meuId)?.nome ?? 'Alguém'} adicionou ${lista} ao grupo`,
            sistema: true,
            criadaEm: agora,
          },
        });
        await tx.chatConversa.update({ where: { id }, data: { atualizadaEm: agora } });
      });
    }

    res.json(await detalheConversa(meuId, id));
  })
);

router.delete(
  '/chat/conversas/:id/participantes/:usuarioId',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const id = idParam(req, 'id');
    const alvoId = idParam(req, 'usuarioId');
    const minha = await participacaoAtiva(id, meuId);
    const conversa = await prisma.chatConversa.findUnique({ where: { id }, select: { tipo: true } });
    if (!conversa) {
      throw new HttpError(404, 'Conversa não encontrada');
    }
    if (conversa.tipo !== 'GRUPO') {
      throw new HttpError(400, 'Conversas individuais não podem ser alteradas');
    }
    const alvo = await prisma.chatParticipante.findFirst({
      where: { conversaId: id, usuarioId: alvoId, saiuEm: null },
      select: { id: true },
    });
    if (!alvo) {
      throw new HttpError(404, 'Participante não encontrado');
    }
    const saindo = alvoId === meuId;
    if (!saindo && !minha.admin) {
      throw new HttpError(403, 'Só administradores do grupo podem remover participantes');
    }

    const nomes = await usuariosPorId([meuId, alvoId]);
    const agora = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.chatParticipante.update({
        where: { conversaId_usuarioId: { conversaId: id, usuarioId: alvoId } },
        data: { saiuEm: agora, admin: false },
      });
      // Sem administrador ativo, o participante ativo mais antigo assume.
      const restantes = await tx.chatParticipante.findMany({
        where: { conversaId: id, saiuEm: null },
        orderBy: [{ entrouEm: 'asc' }, { id: 'asc' }],
        select: { id: true, admin: true },
      });
      if (restantes.length > 0 && !restantes.some((r) => r.admin)) {
        await tx.chatParticipante.update({ where: { id: restantes[0].id }, data: { admin: true } });
      }
      const euNome = nomes.get(meuId)?.nome ?? 'Alguém';
      const texto = saindo
        ? `${euNome} saiu do grupo`
        : `${euNome} removeu ${nomes.get(alvoId)?.nome ?? 'uma pessoa'} do grupo`;
      await tx.chatMensagem.create({
        data: { conversaId: id, autorId: meuId, texto, sistema: true, criadaEm: agora },
      });
      await tx.chatConversa.update({ where: { id }, data: { atualizadaEm: agora } });
    });
    res.status(204).end();
  })
);

// ---------- Mensagens ----------

router.get(
  '/chat/conversas/:id/mensagens',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const id = idParam(req);
    const { antesDe, limite } = validar(listarMensagensSchema, req.query);
    const minha = await participacaoAtiva(id, meuId);
    const linhas = await prisma.chatMensagem.findMany({
      where: {
        conversaId: id,
        criadaEm: { gte: minha.entrouEm },
        ...(antesDe !== undefined ? { id: { lt: antesDe } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limite + 1,
    });
    const haMais = linhas.length > limite;
    const pagina = linhas.slice(0, limite).reverse();
    const leitura = await leituraDaConversa(id, meuId);
    res.json({ itens: await montarMensagens(pagina, meuId, leitura), haMais });
  })
);

router.post(
  '/chat/conversas/:id/mensagens',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const id = idParam(req);
    const dados = validar(enviarMensagemSchema, req.body);
    const texto = (dados.texto ?? '').trim();
    if (texto.length > 4000) {
      throw new HttpError(400, 'A mensagem tem no máximo 4.000 caracteres');
    }
    const imagem = validarImagem(dados.imagem, { aceitaEndereco: false });
    if (texto === '' && imagem === null) {
      throw new HttpError(400, 'Escreva uma mensagem ou envie uma imagem');
    }
    await participacaoAtiva(id, meuId);
    const respostaAId = dados.respostaAId ?? null;
    if (respostaAId !== null) {
      const citada = await prisma.chatMensagem.findFirst({
        where: { id: respostaAId, conversaId: id },
        select: { id: true },
      });
      if (!citada) {
        throw new HttpError(400, 'A mensagem citada não está nesta conversa');
      }
    }
    if (!permitirEnvio(meuId)) {
      throw new HttpError(429, 'Muitas mensagens em pouco tempo. Aguarde um instante.');
    }

    pararDeDigitar(id, meuId);
    const agora = new Date();
    const criada = await prisma.$transaction(async (tx) => {
      const mensagem = await tx.chatMensagem.create({
        data: {
          conversaId: id,
          autorId: meuId,
          texto,
          imagem,
          respostaAId,
          sistema: false,
          criadaEm: agora,
        },
      });
      await tx.chatConversa.update({ where: { id }, data: { atualizadaEm: agora } });
      await tx.chatParticipante.update({
        where: { conversaId_usuarioId: { conversaId: id, usuarioId: meuId } },
        data: { ultimaLeituraEm: agora },
      });
      return mensagem;
    });
    const leitura = await leituraDaConversa(id, meuId);
    const [dto] = await montarMensagens([criada], meuId, leitura);
    res.status(201).json(dto);
  })
);

router.delete(
  '/chat/mensagens/:id',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const id = idParam(req);
    const mensagem = await prisma.chatMensagem.findUnique({
      where: { id },
      select: { id: true, conversaId: true, autorId: true, apagadaEm: true },
    });
    if (!mensagem) {
      throw new HttpError(404, 'Mensagem não encontrada');
    }
    await participacaoAtiva(mensagem.conversaId, meuId);
    if (mensagem.autorId !== meuId) {
      throw new HttpError(403, 'Só o autor pode apagar a mensagem');
    }
    if (mensagem.apagadaEm === null) {
      const agora = new Date();
      await prisma.$transaction([
        prisma.chatMensagem.update({ where: { id }, data: { apagadaEm: agora } }),
        prisma.chatConversa.update({ where: { id: mensagem.conversaId }, data: { atualizadaEm: agora } }),
      ]);
    }
    res.status(204).end();
  })
);

// ---------- Leitura, digitação e tempo real ----------

router.post(
  '/chat/conversas/:id/lida',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const id = idParam(req);
    await participacaoAtiva(id, meuId);
    const agora = new Date();
    await prisma.chatParticipante.update({
      where: { conversaId_usuarioId: { conversaId: id, usuarioId: meuId } },
      data: { ultimaLeituraEm: agora, ultimaEntregaEm: agora },
    });
    res.status(204).end();
  })
);

router.post(
  '/chat/conversas/:id/digitando',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const id = idParam(req);
    await participacaoAtiva(id, meuId);
    marcarDigitando(id, meuId);
    res.status(204).end();
  })
);

router.get(
  '/chat/nao-lidas',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    marcarPresenca(meuId);
    const mapa = await contarNaoLidas(meuId);
    let total = 0;
    for (const n of mapa.values()) {
      total += n;
    }
    res.json({ total });
  })
);

router.get(
  '/chat/sincronizar',
  asyncHandler(async (req, res) => {
    const meuId = req.usuario.id;
    const agora = new Date();
    const { desde: desdeBruto, conversaId } = validar(sincronizarSchema, req.query);
    let desde: Date | null = null;
    if (desdeBruto) {
      const data = new Date(desdeBruto);
      if (Number.isNaN(data.getTime())) {
        throw new HttpError(400, 'Data inválida em desde');
      }
      desde = data;
    }

    marcarPresenca(meuId, agora.getTime());
    const base: BaseConversas = await carregarBase(meuId);

    // Marca como entregue até agora as conversas minhas que tiveram mensagem nova desde a última entrega.
    const entregar: number[] = [];
    for (const minha of base.minhasPorId.values()) {
      const ultima = base.ultimas.get(minha.conversaId);
      const referencia = minha.ultimaEntregaEm ?? minha.entrouEm;
      if (ultima && ultima.criadaEm.getTime() > referencia.getTime()) {
        entregar.push(minha.conversaId);
      }
    }
    if (entregar.length > 0) {
      await prisma.chatParticipante.updateMany({
        where: { usuarioId: meuId, saiuEm: null, conversaId: { in: entregar } },
        data: { ultimaEntregaEm: agora },
      });
    }

    const todas = montarConversas(base, meuId, agora.getTime());
    let naoLidasTotal = 0;
    for (const n of base.naoLidas.values()) {
      naoLidasTotal += n;
    }
    const desdeFixo = desde;
    const conversas: ConversaChat[] = desdeFixo ? todas.filter((c) => conversaMudou(c, base, meuId, desdeFixo)) : todas;

    let aberta: null | {
      mensagens: Awaited<ReturnType<typeof montarMensagens>>;
      digitando: string[];
      leitura: { entregueAte: string | null; lidaAte: string | null };
      online: boolean | null;
    } = null;
    if (conversaId !== undefined && base.minhasPorId.has(conversaId)) {
      const minha = base.minhasPorId.get(conversaId)!;
      const outros = (base.todos.get(conversaId) ?? []).filter((p) => p.usuarioId !== meuId);
      const leitura = leituraDos(outros);
      const conversa = todas.find((c) => c.id === conversaId);
      let mensagens: Awaited<ReturnType<typeof montarMensagens>> = [];
      if (desde) {
        const linhas = await prisma.chatMensagem.findMany({
          where: {
            conversaId,
            criadaEm: { gte: minha.entrouEm },
            OR: [{ criadaEm: { gt: desde } }, { apagadaEm: { gt: desde } }],
          },
          orderBy: { id: 'asc' },
        });
        mensagens = await montarMensagens(linhas, meuId, leitura);
      }
      aberta = {
        mensagens,
        digitando: conversa?.digitando ?? [],
        leitura: {
          entregueAte: leitura.entregueAte ? iso(leitura.entregueAte) : null,
          lidaAte: leitura.lidaAte ? iso(leitura.lidaAte) : null,
        },
        online: conversa?.tipo === 'INDIVIDUAL' ? (conversa.outro?.online ?? null) : null,
      };
    }

    res.json({
      // Folga de 2 s: o criadaEm de uma mensagem é definido antes do commit; sem a folga, uma mensagem
      // gravada nessa janela ficaria antes do próximo "desde". O cliente elimina repetidas pelo id.
      agora: new Date(agora.getTime() - 2000).toISOString(),
      naoLidasTotal,
      conversas,
      aberta,
    });
  })
);

export default router;
