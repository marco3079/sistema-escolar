import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { acessoDeEdicao, acessoTurma, usuariosDosAlunosDaTurma } from '../../lib/turmas';
import { notificar, NovaNotificacao } from '../../lib/notificacoes';
import { registrarTarefaPeriodica } from '../../lib/agendador';
import {
  provaSchema,
  publicarSchema,
  questoesSchema,
  respostasOpcionaisSchema,
  respostasSchema,
  correcaoSchema,
} from './schemas';
import {
  alunoDaInscricao,
  arredondar2,
  calcularExpiracao,
  carregarProva,
  carregarProvaDoAluno,
  confirmarAvaliacao,
  detalheTentativa,
  finalizarNaTransacao,
  finalizarVencidas,
  gravarNotaNoDiario,
  gravarRespostas,
  recalcularNotaDaTentativa,
  iso,
  listaAlternativas,
  montarProvasDTO,
  ordenarQuestoes,
  questaoAluno,
  TOLERANCIA_MS,
  Tx,
} from './servico';

const router = Router();

// Respostas de prova nunca são guardadas em cache.
router.use(/^\/(provas|tentativas|salas\/\d+\/provas)(\/|$)/, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Tentativas vencidas e não enviadas são finalizadas a cada 5 minutos.
registrarTarefaPeriodica('provas-tentativas-vencidas', 5, () => finalizarVencidas());

async function avisarAlunos(turmaId: number, aviso: NovaNotificacao): Promise<void> {
  try {
    const ids = await usuariosDosAlunosDaTurma(turmaId);
    notificar(ids, aviso);
  } catch (erro) {
    console.error('Falha ao avisar alunos da prova:', erro instanceof Error ? erro.message : erro);
  }
}

function buscarTentativa(provaId: number, inscricaoId: number) {
  return prisma.provaTentativa.findUnique({ where: { provaId_inscricaoId: { provaId, inscricaoId } } });
}

function resultadoEnvio(t: { enviadaEm: Date | null; corrigida: boolean; notaFinal: number | null }) {
  return { enviadaEm: t.enviadaEm ? iso(t.enviadaEm) : null, corrigida: t.corrigida, notaFinal: t.notaFinal };
}

// ---------- Edição ----------

router.get(
  '/salas/:turmaId/provas',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    const acesso = await acessoTurma(req, turmaId);
    await finalizarVencidas({ turmaId });
    const provas = await prisma.prova.findMany({
      where: { turmaId, ...(acesso.papel === 'ALUNO' ? { publicada: true } : {}) },
      include: { questoes: { orderBy: { ordem: 'asc' } } },
      orderBy: [{ abreEm: 'desc' }, { id: 'desc' }],
    });
    res.json(await montarProvasDTO(provas, acesso, new Date()));
  })
);

router.post(
  '/salas/:turmaId/provas',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    const acesso = await acessoDeEdicao(req, turmaId);
    const dados = validar(provaSchema, req.body);
    const avaliacaoId = await confirmarAvaliacao(turmaId, dados.avaliacaoId);
    const criada = await prisma.prova.create({
      data: {
        turmaId,
        titulo: dados.titulo,
        instrucoes: dados.instrucoes,
        abreEm: dados.abreEm,
        fechaEm: dados.fechaEm,
        duracaoMin: dados.duracaoMin,
        embaralhar: dados.embaralhar,
        notaMaxima: dados.notaMaxima,
        mostrarGabarito: dados.mostrarGabarito,
        avaliacaoId,
        publicada: false,
        criadoPorId: req.usuario.id,
      },
    });
    const completa = await carregarProva(criada.id);
    res.status(201).json((await montarProvasDTO([completa], acesso, new Date()))[0]);
  })
);

router.put(
  '/provas/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await carregarProva(id);
    const acesso = await acessoDeEdicao(req, atual.turmaId);
    const dados = validar(provaSchema, req.body);
    const avaliacaoId = await confirmarAvaliacao(atual.turmaId, dados.avaliacaoId);

    await prisma.$transaction(async (tx) => {
      const tentativas = await tx.provaTentativa.count({ where: { provaId: id } });
      const fechaMudou = dados.fechaEm.getTime() !== atual.fechaEm.getTime();
      if (tentativas > 0) {
        const estrutura =
          dados.abreEm.getTime() !== atual.abreEm.getTime() ||
          dados.duracaoMin !== atual.duracaoMin ||
          dados.embaralhar !== atual.embaralhar ||
          dados.notaMaxima !== atual.notaMaxima ||
          avaliacaoId !== atual.avaliacaoId;
        if (estrutura) {
          throw new HttpError(409, 'Com tentativas iniciadas, só o título, as instruções, o fechamento (para depois) e o gabarito podem mudar');
        }
        if (dados.fechaEm.getTime() < atual.fechaEm.getTime()) {
          throw new HttpError(409, 'Com tentativas iniciadas, o fechamento só pode ser adiado');
        }
      }
      await tx.prova.update({
        where: { id },
        data: {
          titulo: dados.titulo,
          instrucoes: dados.instrucoes,
          abreEm: dados.abreEm,
          fechaEm: dados.fechaEm,
          duracaoMin: dados.duracaoMin,
          embaralhar: dados.embaralhar,
          notaMaxima: dados.notaMaxima,
          mostrarGabarito: dados.mostrarGabarito,
          avaliacaoId,
        },
      });
      if (tentativas > 0 && fechaMudou) {
        // Fechamento adiado: as tentativas em andamento ganham o novo limite, se ele for o menor.
        const abertas = await tx.provaTentativa.findMany({
          where: { provaId: id, enviadaEm: null },
          select: { id: true, iniciadaEm: true, expiraEm: true },
        });
        for (const t of abertas) {
          const nova = calcularExpiracao(t.iniciadaEm, { duracaoMin: dados.duracaoMin, fechaEm: dados.fechaEm });
          if (nova.getTime() !== t.expiraEm.getTime()) {
            await tx.provaTentativa.update({ where: { id: t.id }, data: { expiraEm: nova } });
          }
        }
      }
    });

    const atualizada = await carregarProva(id);
    res.json((await montarProvasDTO([atualizada], acesso, new Date()))[0]);
  })
);

router.put(
  '/provas/:id/questoes',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await carregarProva(id);
    const acesso = await acessoDeEdicao(req, atual.turmaId);
    const dados = validar(questoesSchema, req.body);

    await prisma.$transaction(async (tx) => {
      const tentativas = await tx.provaTentativa.count({ where: { provaId: id } });
      if (tentativas > 0) {
        throw new HttpError(409, 'A prova já foi iniciada: as questões não podem mais mudar');
      }
      await tx.provaQuestao.deleteMany({ where: { provaId: id } });
      for (const [indice, q] of dados.questoes.entries()) {
        await tx.provaQuestao.create({
          data: {
            provaId: id,
            ordem: indice + 1,
            tipo: q.tipo,
            enunciado: q.enunciado,
            alternativas: q.alternativas,
            correta: q.correta,
            pontos: q.pontos,
          },
        });
      }
    });

    const atualizada = await carregarProva(id);
    res.json((await montarProvasDTO([atualizada], acesso, new Date()))[0]);
  })
);

router.post(
  '/provas/:id/publicar',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await carregarProva(id);
    const acesso = await acessoDeEdicao(req, atual.turmaId);
    const { publicada } = validar(publicarSchema, req.body);

    if (publicada) {
      if (atual.questoes.length === 0) {
        throw new HttpError(400, 'A prova precisa de ao menos uma questão para ser publicada');
      }
    } else {
      const tentativas = await prisma.provaTentativa.count({ where: { provaId: id } });
      if (tentativas > 0) {
        throw new HttpError(409, 'Não é possível despublicar: a prova já tem tentativas iniciadas');
      }
    }

    await prisma.prova.update({ where: { id }, data: { publicada } });
    if (publicada && !atual.publicada) {
      await avisarAlunos(atual.turmaId, {
        tipo: 'AULA',
        titulo: `Prova disponível em ${acesso.turma.disciplina.nome}: ${atual.titulo}`,
        link: `/sala/${atual.turmaId}?aba=provas`,
        chave: `prova-publicada:${id}`,
      });
    }

    const atualizada = await carregarProva(id);
    res.json((await montarProvasDTO([atualizada], acesso, new Date()))[0]);
  })
);

router.delete(
  '/provas/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await carregarProva(id);
    await acessoDeEdicao(req, atual.turmaId);
    await prisma.prova.delete({ where: { id } });
    res.status(204).end();
  })
);

// ---------- Aluno ----------

router.post(
  '/provas/:id/iniciar',
  asyncHandler(async (req, res) => {
    const provaId = idParam(req);
    const { prova, acesso } = await carregarProvaDoAluno(req, provaId);
    await finalizarVencidas({ provaId });
    const inscricaoId = acesso.inscricaoId;
    const agora = new Date();

    let tentativa = await buscarTentativa(provaId, inscricaoId);
    let criada = false;
    if (!tentativa) {
      if (agora < prova.abreEm || agora > prova.fechaEm) {
        throw new HttpError(409, 'A prova não está aberta agora');
      }
      try {
        tentativa = await prisma.provaTentativa.create({
          data: {
            provaId,
            inscricaoId,
            iniciadaEm: agora,
            expiraEm: calcularExpiracao(agora, prova),
          },
        });
        criada = true;
      } catch (erro) {
        // Chamadas simultâneas: a restrição única barra a segunda; devolve a que ganhou.
        if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')) {
          throw erro;
        }
        tentativa = await buscarTentativa(provaId, inscricaoId);
      }
    }
    if (!tentativa) {
      throw new HttpError(409, 'Não foi possível iniciar a prova. Tente de novo.');
    }
    if (tentativa.enviadaEm) {
      throw new HttpError(409, 'Esta prova já foi enviada');
    }

    const respostas = await prisma.provaResposta.findMany({
      where: { tentativaId: tentativa.id },
      select: { questaoId: true, alternativa: true, texto: true },
    });
    const ordem = ordenarQuestoes(prova.questoes, tentativa.id, prova.embaralhar);
    res.status(criada ? 201 : 200).json({
      tentativa: {
        id: tentativa.id,
        iniciadaEm: iso(tentativa.iniciadaEm),
        expiraEm: iso(tentativa.expiraEm),
        enviadaEm: null,
      },
      agora: agora.toISOString(),
      questoes: ordem.map((q, indice) => questaoAluno(q, indice + 1)),
      respostas,
    });
  })
);

router.put(
  '/provas/:id/respostas',
  asyncHandler(async (req, res) => {
    const provaId = idParam(req);
    const { prova, acesso } = await carregarProvaDoAluno(req, provaId);
    const dados = validar(respostasSchema, req.body);
    await finalizarVencidas({ provaId });
    const agora = new Date();

    await prisma.$transaction(async (tx: Tx) => {
      const tentativa = await tx.provaTentativa.findUnique({
        where: { provaId_inscricaoId: { provaId, inscricaoId: acesso.inscricaoId } },
      });
      if (!tentativa) throw new HttpError(409, 'Inicie a prova antes de salvar as respostas');
      if (tentativa.enviadaEm) throw new HttpError(409, 'A prova já foi enviada');
      if (agora.getTime() > tentativa.expiraEm.getTime() + TOLERANCIA_MS) {
        throw new HttpError(409, 'O tempo da prova acabou');
      }
      await gravarRespostas(tx, tentativa.id, prova.questoes, dados.respostas);
    });
    res.status(204).end();
  })
);

router.post(
  '/provas/:id/enviar',
  asyncHandler(async (req, res) => {
    const provaId = idParam(req);
    const { acesso } = await carregarProvaDoAluno(req, provaId);
    await finalizarVencidas({ provaId });
    const tentativa = await buscarTentativa(provaId, acesso.inscricaoId);
    if (!tentativa) throw new HttpError(409, 'Inicie a prova antes de enviar');
    if (tentativa.enviadaEm) {
      res.json(resultadoEnvio(tentativa));
      return;
    }

    const agora = new Date();
    // Respostas do corpo só são aceitas até 15 s depois do fim; depois disso vale o que já estava salvo.
    const dentroDaTolerancia = agora.getTime() <= tentativa.expiraEm.getTime() + TOLERANCIA_MS;
    const corpo = dentroDaTolerancia ? validar(respostasOpcionaisSchema, req.body ?? {}) : null;
    const respostas = corpo?.respostas ?? null;

    await prisma.$transaction((tx) => finalizarNaTransacao(tx, tentativa.id, agora, respostas));
    await recalcularNotaDaTentativa(tentativa.id);
    const atual = await prisma.provaTentativa.findUniqueOrThrow({ where: { id: tentativa.id } });
    res.json(resultadoEnvio(atual));
  })
);

router.get(
  '/provas/:id/minha',
  asyncHandler(async (req, res) => {
    const provaId = idParam(req);
    const { prova, acesso } = await carregarProvaDoAluno(req, provaId);
    await finalizarVencidas({ provaId });
    const agora = new Date();

    const tentativa = await prisma.provaTentativa.findUnique({
      where: { provaId_inscricaoId: { provaId, inscricaoId: acesso.inscricaoId } },
      include: { respostas: true },
    });

    let gabarito: null | {
      questaoId: number;
      enunciado: string;
      tipo: string;
      alternativas: string[];
      correta: number | null;
      minhaAlternativa: number | null;
      meuTexto: string;
      pontos: number;
      pontosObtidos: number | null;
      comentario: string;
    }[] = null;
    if (tentativa?.enviadaEm && prova.mostrarGabarito && agora > prova.fechaEm) {
      const porQuestao = new Map(tentativa.respostas.map((r) => [r.questaoId, r]));
      gabarito = ordenarQuestoes(prova.questoes, tentativa.id, prova.embaralhar).map((q) => {
        const r = porQuestao.get(q.id);
        const dissertativa = q.tipo === 'DISSERTATIVA';
        return {
          questaoId: q.id,
          enunciado: q.enunciado,
          tipo: q.tipo,
          alternativas: listaAlternativas(q.alternativas),
          correta: dissertativa ? null : q.correta,
          minhaAlternativa: r?.alternativa ?? null,
          meuTexto: r?.texto ?? '',
          pontos: q.pontos,
          pontosObtidos: dissertativa ? (r?.pontos ?? null) : (r?.pontos ?? 0),
          comentario: r?.comentario ?? '',
        };
      });
    }

    res.json({
      tentativa: tentativa
        ? {
            id: tentativa.id,
            iniciadaEm: iso(tentativa.iniciadaEm),
            expiraEm: iso(tentativa.expiraEm),
            enviadaEm: tentativa.enviadaEm ? iso(tentativa.enviadaEm) : null,
          }
        : null,
      corrigida: tentativa?.corrigida ?? false,
      notaFinal: tentativa?.corrigida ? tentativa.notaFinal : null,
      gabarito,
    });
  })
);

// ---------- Professor e gestão ----------

router.get(
  '/provas/:id/tentativas',
  asyncHandler(async (req, res) => {
    const provaId = idParam(req);
    const prova = await carregarProva(provaId);
    const acesso = await acessoTurma(req, prova.turmaId);
    if (acesso.papel === 'ALUNO') throw new HttpError(403, 'Sem permissão');
    await finalizarVencidas({ provaId });

    const dissertativas = new Set(prova.questoes.filter((q) => q.tipo === 'DISSERTATIVA').map((q) => q.id));
    const inscricoes = await prisma.inscricao.findMany({
      where: { turmaId: prova.turmaId, status: { not: 'TRANCADO' } },
      select: { id: true, matricula: { select: { aluno: { select: { ra: true, usuario: { select: { nome: true } } } } } } },
    });
    const tentativas = await prisma.provaTentativa.findMany({
      where: { provaId },
      select: {
        id: true,
        inscricaoId: true,
        iniciadaEm: true,
        enviadaEm: true,
        corrigida: true,
        notaObjetiva: true,
        notaFinal: true,
        respostas: { where: { pontos: null }, select: { questaoId: true } },
      },
    });
    const porInscricao = new Map(tentativas.map((t) => [t.inscricaoId, t]));

    const lista = inscricoes
      .map((i) => {
        const t = porInscricao.get(i.id);
        return {
          inscricaoId: i.id,
          aluno: { nome: i.matricula.aluno.usuario.nome, ra: i.matricula.aluno.ra },
          tentativa: t
            ? {
                id: t.id,
                iniciadaEm: iso(t.iniciadaEm),
                enviadaEm: t.enviadaEm ? iso(t.enviadaEm) : null,
                corrigida: t.corrigida,
                notaObjetiva: t.notaObjetiva,
                notaFinal: t.notaFinal,
                pendentes: t.enviadaEm ? t.respostas.filter((r) => dissertativas.has(r.questaoId)).length : 0,
              }
            : null,
        };
      })
      .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
    res.json(lista);
  })
);

router.get(
  '/tentativas/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const tentativa = await prisma.provaTentativa.findUnique({ where: { id }, select: { prova: { select: { turmaId: true } } } });
    if (!tentativa) throw new HttpError(404, 'Tentativa não encontrada');
    const acesso = await acessoTurma(req, tentativa.prova.turmaId);
    if (acesso.papel === 'ALUNO') throw new HttpError(403, 'Sem permissão');
    res.json(await detalheTentativa(id));
  })
);

router.put(
  '/tentativas/:id/correcao',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const tentativa = await prisma.provaTentativa.findUnique({ where: { id }, select: { prova: { select: { turmaId: true } } } });
    if (!tentativa) throw new HttpError(404, 'Tentativa não encontrada');
    await acessoDeEdicao(req, tentativa.prova.turmaId);
    const dados = validar(correcaoSchema, req.body);

    const virouCorrigida = await prisma.$transaction(async (tx: Tx) => {
      const atual = await tx.provaTentativa.findUniqueOrThrow({
        where: { id },
        include: { prova: { include: { questoes: { orderBy: { ordem: 'asc' } } } } },
      });
      if (!atual.enviadaEm) throw new HttpError(409, 'A prova ainda não foi enviada');
      const prova = atual.prova;
      const dissertativas = new Map(prova.questoes.filter((q) => q.tipo === 'DISSERTATIVA').map((q) => [q.id, q]));

      for (const c of dados.respostas) {
        const questao = dissertativas.get(c.questaoId);
        if (!questao) throw new HttpError(400, 'Questão dissertativa não encontrada nesta prova');
        if (c.pontos > questao.pontos) {
          throw new HttpError(400, `Os pontos passam do máximo da questão (${questao.pontos})`);
        }
        await tx.provaResposta.upsert({
          where: { tentativaId_questaoId: { tentativaId: id, questaoId: questao.id } },
          create: { tentativaId: id, questaoId: questao.id, alternativa: null, texto: '', pontos: c.pontos, comentario: c.comentario ?? '' },
          update: { pontos: c.pontos, comentario: c.comentario ?? '' },
        });
      }

      const linhas = await tx.provaResposta.findMany({ where: { tentativaId: id } });
      const pontosPorQuestao = new Map(linhas.map((l) => [l.questaoId, l.pontos]));
      const pendentes = [...dissertativas.keys()].some((qid) => pontosPorQuestao.get(qid) === null || pontosPorQuestao.get(qid) === undefined);
      if (pendentes) return false;

      let obtidos = 0;
      for (const q of prova.questoes) {
        obtidos += pontosPorQuestao.get(q.id) ?? 0;
      }
      const total = prova.questoes.reduce((soma, q) => soma + q.pontos, 0);
      const notaFinal = total > 0 ? arredondar2((obtidos / total) * prova.notaMaxima) : 0;
      await tx.provaTentativa.update({ where: { id }, data: { corrigida: true, notaFinal } });
      await gravarNotaNoDiario(tx, prova, atual.inscricaoId, notaFinal);
      return !atual.corrigida;
    });

    await recalcularNotaDaTentativa(id);

    if (virouCorrigida) {
      const info = await prisma.provaTentativa.findUnique({
        where: { id },
        select: { inscricaoId: true, prova: { select: { titulo: true, turmaId: true } } },
      });
      if (info) {
        const aluno = await alunoDaInscricao(info.inscricaoId);
        notificar([aluno.usuarioId], {
          tipo: 'AULA',
          titulo: `Prova corrigida: ${info.prova.titulo}`,
          link: `/sala/${info.prova.turmaId}?aba=provas`,
          chave: `prova-corrigida:${id}`,
        });
      }
    }

    res.json(await detalheTentativa(id));
  })
);

export default router;
