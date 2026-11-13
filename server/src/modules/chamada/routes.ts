import crypto from 'crypto';
import { Request, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { acessoDeAluno, acessoDeEdicao } from '../../lib/turmas';

// Chamada por QR code (Contrato E).
// Código rotativo: 6 dígitos tirados de HMAC-SHA256(segredo, janela), com janela = floor(agora / 20 s).
// Vale a janela atual e a anterior. O segredo nunca sai pela API nem vai para o log.
// Texto do QR e do código digitado: "{chamadaId}-{codigo}".

const JANELA_MS = 20 * 1000;
const MENSAGEM_CODIGO_INVALIDO = 'Código inválido ou vencido. Leia o código de novo.';
const MENSAGEM_ENCERRADA = 'A chamada foi encerrada';

// Limite de tentativas de presença (em memória): 10 por minuto por usuário.
const JANELA_TENTATIVAS_MS = 60 * 1000;
const LIMITE_TENTATIVAS = 10;
const LIMITE_CHAVES_TENTATIVAS = 5000;
const tentativasPorUsuario = new Map<number, number[]>();

function tentativasRecentes(usuarioId: number, agora: number): number[] {
  return (tentativasPorUsuario.get(usuarioId) ?? []).filter((instante) => agora - instante < JANELA_TENTATIVAS_MS);
}

function limparTentativasVencidas(): void {
  const agora = Date.now();
  for (const [usuarioId] of tentativasPorUsuario) {
    const recentes = tentativasRecentes(usuarioId, agora);
    if (recentes.length === 0) {
      tentativasPorUsuario.delete(usuarioId);
    } else {
      tentativasPorUsuario.set(usuarioId, recentes);
    }
  }
}

setInterval(limparTentativasVencidas, JANELA_TENTATIVAS_MS).unref();

// Código de 6 dígitos (com zeros à esquerda) para uma janela de 20 s.
function codigoDaJanela(segredo: string, janela: number): string {
  const mac = crypto.createHmac('sha256', segredo).update(String(janela)).digest();
  const deslocamento = mac[mac.length - 1] & 0x0f;
  const binario = mac.readUInt32BE(deslocamento) & 0x7fffffff;
  return String(binario % 1000000).padStart(6, '0');
}

// Compara em tempo constante. Os dois lados têm sempre 6 caracteres, mas confere o tamanho antes.
function codigosIguais(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Segundos que faltam para a próxima janela de 20 s (1 a 20).
function segundosParaTroca(agora: number): number {
  const proximaJanela = (Math.floor(agora / JANELA_MS) + 1) * JANELA_MS;
  return Math.ceil((proximaJanela - agora) / 1000);
}

export interface ChamadaEstado {
  aberta: boolean;
  fechaEm: string | null;
  token: string | null;
  trocaEmSeg: number;
  presentes: number;
  total: number;
  lista: { inscricaoId: number; nome: string; ra: string; presente: boolean | null }[];
}

// Estado da chamada da aula para a tela do professor. Nunca traz o segredo.
async function montarEstado(
  aulaId: number,
  turmaId: number,
  chamada: { id: number; segredo: string; fechaEm: Date; fechada: boolean } | null,
  agora: number
): Promise<ChamadaEstado> {
  const [inscricoes, presencas] = await Promise.all([
    prisma.inscricao.findMany({
      where: { turmaId, status: { not: 'TRANCADO' } },
      select: {
        id: true,
        matricula: { select: { aluno: { select: { ra: true, usuario: { select: { nome: true } } } } } },
      },
      orderBy: { matricula: { aluno: { usuario: { nome: 'asc' } } } },
    }),
    prisma.presenca.findMany({
      where: { aulaId },
      select: { inscricaoId: true, presente: true },
    }),
  ]);

  const presencaPorInscricao = new Map<number, boolean>();
  for (const p of presencas) {
    presencaPorInscricao.set(p.inscricaoId, p.presente);
  }

  const lista = inscricoes.map((i) => ({
    inscricaoId: i.id,
    nome: i.matricula.aluno.usuario.nome,
    ra: i.matricula.aluno.ra,
    presente: presencaPorInscricao.has(i.id) ? (presencaPorInscricao.get(i.id) as boolean) : null,
  }));

  // Chamada vencida (fechaEm passou) ou fechada conta como encerrada.
  const aberta = chamada !== null && !chamada.fechada && chamada.fechaEm.getTime() > agora;

  let token: string | null = null;
  let trocaEmSeg = 0;
  if (chamada && aberta) {
    const janela = Math.floor(agora / JANELA_MS);
    token = `${chamada.id}-${codigoDaJanela(chamada.segredo, janela)}`;
    trocaEmSeg = segundosParaTroca(agora);
  }

  return {
    aberta,
    fechaEm: chamada ? chamada.fechaEm.toISOString() : null,
    token,
    trocaEmSeg,
    presentes: lista.filter((l) => l.presente === true).length,
    total: lista.length,
    lista,
  };
}

async function buscarAula(aulaId: number): Promise<{ id: number; turmaId: number }> {
  const aula = await prisma.aula.findUnique({
    where: { id: aulaId },
    select: { id: true, turmaId: true },
  });
  if (!aula) throw new HttpError(404, 'Aula não encontrada');
  return aula;
}

const router = Router();

const abrirSchema = z.object({
  minutos: z.number().int().min(1).max(60).default(10),
});

const fecharSchema = z.object({
  marcarFaltas: z.boolean().optional(),
});

// Abre (ou reabre, com segredo novo) a chamada da aula. Presenças já gravadas não são apagadas.
router.post(
  '/aulas/:aulaId/chamada-qr',
  asyncHandler(async (req, res) => {
    const aulaId = idParam(req, 'aulaId');
    const aula = await buscarAula(aulaId);
    await acessoDeEdicao(req, aula.turmaId);
    const { minutos } = validar(abrirSchema, req.body ?? {});
    const agora = Date.now();
    const fechaEm = new Date(agora + minutos * 60 * 1000);
    const segredo = crypto.randomBytes(32).toString('hex');

    const chamada = await prisma.chamadaQr.upsert({
      where: { aulaId },
      create: { aulaId, segredo, abertaEm: new Date(agora), fechaEm, fechada: false },
      update: { segredo, abertaEm: new Date(agora), fechaEm, fechada: false },
      select: { id: true, segredo: true, fechaEm: true, fechada: true },
    });

    res.json(await montarEstado(aulaId, aula.turmaId, chamada, agora));
  })
);

// Estado da chamada (consultado a cada 2 s pela tela do professor; fora do registro de atividades).
router.get(
  '/aulas/:aulaId/chamada-qr',
  asyncHandler(async (req, res) => {
    const aulaId = idParam(req, 'aulaId');
    const aula = await buscarAula(aulaId);
    await acessoDeEdicao(req, aula.turmaId);
    const chamada = await prisma.chamadaQr.findUnique({
      where: { aulaId },
      select: { id: true, segredo: true, fechaEm: true, fechada: true },
    });

    res.json(await montarEstado(aulaId, aula.turmaId, chamada, Date.now()));
  })
);

// Encerra a chamada. Com marcarFaltas, quem ficou sem registro recebe falta.
router.post(
  '/aulas/:aulaId/chamada-qr/fechar',
  asyncHandler(async (req, res) => {
    const aulaId = idParam(req, 'aulaId');
    const aula = await buscarAula(aulaId);
    await acessoDeEdicao(req, aula.turmaId);
    const { marcarFaltas } = validar(fecharSchema, req.body ?? {});
    const existente = await prisma.chamadaQr.findUnique({ where: { aulaId }, select: { id: true } });
    if (!existente) throw new HttpError(404, 'Esta aula não tem chamada');

    const agora = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.chamadaQr.update({
        where: { aulaId },
        data: { fechada: true, fechaEm: agora },
      });
      if (marcarFaltas) {
        const inscricoes = await tx.inscricao.findMany({
          where: { turmaId: aula.turmaId, status: { not: 'TRANCADO' } },
          select: { id: true },
        });
        const registrados = await tx.presenca.findMany({
          where: { aulaId },
          select: { inscricaoId: true },
        });
        const jaRegistrados = new Set(registrados.map((r) => r.inscricaoId));
        const semRegistro = inscricoes.filter((i) => !jaRegistrados.has(i.id));
        if (semRegistro.length > 0) {
          await tx.presenca.createMany({
            data: semRegistro.map((i) => ({ aulaId, inscricaoId: i.id, presente: false })),
            skipDuplicates: true,
          });
        }
      }
    });

    res.status(204).end();
  })
);

// Limite de tentativas por usuário: 10 por minuto. Conta cada envio.
function registrarTentativa(req: Request): void {
  const usuarioId = req.usuario.id;
  const agora = Date.now();
  const recentes = tentativasRecentes(usuarioId, agora);
  if (recentes.length >= LIMITE_TENTATIVAS) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde um minuto.');
  }
  if (tentativasPorUsuario.size >= LIMITE_CHAVES_TENTATIVAS) {
    limparTentativasVencidas();
  }
  tentativasPorUsuario.set(usuarioId, [...recentes, agora]);
}

// Confere se o código (6 dígitos) é o da janela atual ou da anterior.
function codigoEhValido(segredo: string, codigo: string, agora: number): boolean {
  const janelaAtual = Math.floor(agora / JANELA_MS);
  const atual = codigosIguais(codigo, codigoDaJanela(segredo, janelaAtual));
  const anterior = codigosIguais(codigo, codigoDaJanela(segredo, janelaAtual - 1));
  return atual || anterior;
}

const FORMATO_TOKEN = /^(\d{1,15})-(\d{6})$/;

// Aluno marca presença lendo o QR ou digitando o código "{chamadaId}-{codigo}".
router.post(
  '/presenca-qr',
  asyncHandler(async (req, res) => {
    registrarTentativa(req);

    const bruto = typeof req.body?.token === 'string' ? req.body.token : '';
    const casamento = FORMATO_TOKEN.exec(bruto);
    if (!casamento) {
      throw new HttpError(400, MENSAGEM_CODIGO_INVALIDO);
    }
    const chamadaId = Number(casamento[1]);
    const codigo = casamento[2];
    if (!Number.isSafeInteger(chamadaId) || chamadaId <= 0) {
      throw new HttpError(400, MENSAGEM_CODIGO_INVALIDO);
    }

    const chamada = await prisma.chamadaQr.findUnique({
      where: { id: chamadaId },
      select: { aulaId: true, segredo: true, fechaEm: true, fechada: true },
    });
    if (!chamada) {
      throw new HttpError(400, MENSAGEM_CODIGO_INVALIDO);
    }

    const agora = Date.now();
    if (chamada.fechada || chamada.fechaEm.getTime() <= agora) {
      throw new HttpError(409, MENSAGEM_ENCERRADA);
    }

    if (!codigoEhValido(chamada.segredo, codigo, agora)) {
      throw new HttpError(400, MENSAGEM_CODIGO_INVALIDO);
    }

    // A turma vem da aula (ChamadaQr só tem aulaId).
    const aula = await prisma.aula.findUnique({
      where: { id: chamada.aulaId },
      select: { id: true, data: true, turmaId: true },
    });
    if (!aula) {
      throw new HttpError(400, MENSAGEM_CODIGO_INVALIDO);
    }

    const acesso = await acessoDeAluno(req, aula.turmaId);
    await prisma.presenca.upsert({
      where: { aulaId_inscricaoId: { aulaId: aula.id, inscricaoId: acesso.inscricaoId } },
      create: { aulaId: aula.id, inscricaoId: acesso.inscricaoId, presente: true },
      update: { presente: true },
    });

    res.json({
      ok: true,
      disciplina: acesso.turma.disciplina.nome,
      data: aula.data.toISOString(),
    });
  })
);

export default router;
