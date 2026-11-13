import { createHash } from 'crypto';
import type { Prisma, Prova, ProvaQuestao, TipoQuestao } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/erros';
import { acessoDeAluno, AcessoTurma } from '../../lib/turmas';
import { recalcularInscricoes } from '../diario/calculo';
import type { RespostaEntrada } from './schemas';

// Regras das provas: DTOs, tempo, correção, embaralhamento e nota no diário.

export const TOLERANCIA_MS = 15_000;
const MS_MINUTO = 60_000;

export type Tx = Prisma.TransactionClient;
export type ProvaComQuestoes = Prova & { questoes: ProvaQuestao[] };

export interface QuestaoEdicao {
  id?: number;
  tipo: TipoQuestao;
  enunciado: string;
  alternativas: string[];
  correta: number | null;
  pontos: number;
}

export interface QuestaoAluno {
  id: number;
  ordem: number;
  tipo: TipoQuestao;
  enunciado: string;
  alternativas: string[];
  pontos: number;
}

export interface ProvaDTO {
  id: number;
  titulo: string;
  instrucoes: string;
  abreEm: string;
  fechaEm: string;
  duracaoMin: number;
  embaralhar: boolean;
  notaMaxima: number;
  mostrarGabarito: boolean;
  publicada: boolean;
  avaliacaoId: number | null;
  totalQuestoes: number;
  totalPontos: number;
  estado?: 'AGENDADA' | 'ABERTA' | 'EM_ANDAMENTO' | 'ENVIADA' | 'ENCERRADA';
  minhaNota?: number | null;
  questoes?: QuestaoEdicao[];
  resumo?: { alunos: number; enviadas: number; corrigidas: number; temTentativa: boolean };
}

export function iso(data: Date): string {
  return data.toISOString();
}

// Arredonda em 2 casas decimais.
export function arredondar2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function listaAlternativas(valor: Prisma.JsonValue): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : [];
}

// Ordem das questões da tentativa. Com embaralhar, a ordem vem de um hash de tentativa + questão:
// é a mesma em cada chamada da mesma tentativa e muda entre tentativas.
export function ordenarQuestoes(questoes: ProvaQuestao[], tentativaId: number, embaralhar: boolean): ProvaQuestao[] {
  if (!embaralhar) {
    return questoes;
  }
  const chave = (questaoId: number) =>
    createHash('sha256').update(`${tentativaId}:${questaoId}`).digest('hex');
  return [...questoes].sort((a, b) => {
    const ca = chave(a.id);
    const cb = chave(b.id);
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });
}

export function calcularExpiracao(inicio: Date, prova: { duracaoMin: number; fechaEm: Date }): Date {
  return new Date(Math.min(inicio.getTime() + prova.duracaoMin * MS_MINUTO, prova.fechaEm.getTime()));
}

export function estadoAluno(
  prova: { abreEm: Date; fechaEm: Date },
  tentativa: { enviadaEm: Date | null } | null,
  agora: Date
): NonNullable<ProvaDTO['estado']> {
  if (tentativa?.enviadaEm) return 'ENVIADA';
  if (tentativa) return 'EM_ANDAMENTO';
  if (agora < prova.abreEm) return 'AGENDADA';
  if (agora > prova.fechaEm) return 'ENCERRADA';
  return 'ABERTA';
}

export function questaoAluno(q: ProvaQuestao, ordem: number): QuestaoAluno {
  return {
    id: q.id,
    ordem,
    tipo: q.tipo,
    enunciado: q.enunciado,
    alternativas: listaAlternativas(q.alternativas),
    pontos: q.pontos,
  };
}

export async function carregarProva(id: number): Promise<ProvaComQuestoes> {
  const prova = await prisma.prova.findUnique({
    where: { id },
    include: { questoes: { orderBy: { ordem: 'asc' } } },
  });
  if (!prova) throw new HttpError(404, 'Prova não encontrada');
  return prova;
}

// Prova para o aluno: confere a inscrição (403) e só deixa ver prova publicada (404).
export async function carregarProvaDoAluno(
  req: Parameters<typeof acessoDeAluno>[0],
  provaId: number
): Promise<{ prova: ProvaComQuestoes; acesso: AcessoTurma & { inscricaoId: number; matriculaId: number } }> {
  const prova = await carregarProva(provaId);
  const acesso = await acessoDeAluno(req, prova.turmaId);
  if (!prova.publicada) throw new HttpError(404, 'Prova não encontrada');
  return { prova, acesso };
}

export async function confirmarAvaliacao(turmaId: number, avaliacaoId: number | null | undefined): Promise<number | null> {
  if (avaliacaoId === null || avaliacaoId === undefined) return null;
  const avaliacao = await prisma.avaliacao.findFirst({ where: { id: avaliacaoId, turmaId }, select: { id: true } });
  if (!avaliacao) throw new HttpError(400, 'A avaliação escolhida não é desta turma');
  return avaliacao.id;
}

// DTOs da lista de provas. Aluno: estado e nota. Professor e gestão: questões com gabarito e resumo.
export async function montarProvasDTO(provas: ProvaComQuestoes[], acesso: AcessoTurma, agora: Date): Promise<ProvaDTO[]> {
  const aluno = acesso.papel === 'ALUNO';
  const minhaInscricao = acesso.inscricaoId;
  const tentativas = await prisma.provaTentativa.findMany({
    where: {
      provaId: { in: provas.map((p) => p.id) },
      ...(aluno && minhaInscricao !== null ? { inscricaoId: minhaInscricao } : {}),
    },
    select: { provaId: true, enviadaEm: true, corrigida: true, notaFinal: true },
  });
  const alunos = aluno
    ? 0
    : await prisma.inscricao.count({ where: { turmaId: acesso.turma.id, status: { not: 'TRANCADO' } } });

  return provas.map((p) => {
    const delas = tentativas.filter((t) => t.provaId === p.id);
    const base: ProvaDTO = {
      id: p.id,
      titulo: p.titulo,
      instrucoes: p.instrucoes,
      abreEm: iso(p.abreEm),
      fechaEm: iso(p.fechaEm),
      duracaoMin: p.duracaoMin,
      embaralhar: p.embaralhar,
      notaMaxima: p.notaMaxima,
      mostrarGabarito: p.mostrarGabarito,
      publicada: p.publicada,
      avaliacaoId: p.avaliacaoId,
      totalQuestoes: p.questoes.length,
      totalPontos: p.questoes.reduce((soma, q) => soma + q.pontos, 0),
    };
    if (aluno) {
      const minha = delas[0] ?? null;
      return {
        ...base,
        estado: estadoAluno(p, minha, agora),
        minhaNota: minha?.corrigida ? minha.notaFinal : null,
      };
    }
    return {
      ...base,
      questoes: p.questoes.map((q) => ({
        id: q.id,
        tipo: q.tipo,
        enunciado: q.enunciado,
        alternativas: listaAlternativas(q.alternativas),
        correta: q.correta,
        pontos: q.pontos,
      })),
      resumo: {
        alunos,
        enviadas: delas.filter((t) => t.enviadaEm !== null).length,
        corrigidas: delas.filter((t) => t.corrigida).length,
        temTentativa: delas.length > 0,
      },
    };
  });
}

// Grava ou atualiza respostas. Valida que a questão é da prova e que a alternativa está na faixa.
export async function gravarRespostas(
  tx: Tx,
  tentativaId: number,
  questoes: ProvaQuestao[],
  respostas: RespostaEntrada[]
): Promise<void> {
  const porId = new Map(questoes.map((q) => [q.id, q]));
  for (const r of respostas) {
    const questao = porId.get(r.questaoId);
    if (!questao) throw new HttpError(400, 'Questão que não pertence a esta prova');
    let alternativa: number | null | undefined = undefined;
    let texto: string | undefined = undefined;
    if (questao.tipo === 'DISSERTATIVA') {
      texto = r.texto;
    } else if (r.alternativa !== undefined) {
      if (r.alternativa !== null) {
        const ultima = questao.tipo === 'VERDADEIRO_FALSO' ? 1 : listaAlternativas(questao.alternativas).length - 1;
        if (r.alternativa < 0 || r.alternativa > ultima) {
          throw new HttpError(400, 'Alternativa fora da faixa desta questão');
        }
      }
      alternativa = r.alternativa;
    }
    const atualizar: Prisma.ProvaRespostaUncheckedUpdateInput = {};
    if (alternativa !== undefined) atualizar.alternativa = alternativa;
    if (texto !== undefined) atualizar.texto = texto;
    await tx.provaResposta.upsert({
      where: { tentativaId_questaoId: { tentativaId, questaoId: questao.id } },
      create: { tentativaId, questaoId: questao.id, alternativa: alternativa ?? null, texto: texto ?? '' },
      update: atualizar,
    });
  }
}

// Grava a nota final no diário (Nota da avaliação ligada), escalada pela nota máxima da avaliação.
export async function gravarNotaNoDiario(
  tx: Tx,
  prova: { avaliacaoId: number | null; notaMaxima: number },
  inscricaoId: number,
  notaFinal: number
): Promise<void> {
  if (prova.avaliacaoId === null) return;
  const avaliacao = await tx.avaliacao.findUnique({ where: { id: prova.avaliacaoId }, select: { id: true, notaMaxima: true } });
  if (!avaliacao) return;
  const valor = arredondar2(notaFinal * (avaliacao.notaMaxima / prova.notaMaxima));
  await tx.nota.upsert({
    where: { avaliacaoId_inscricaoId: { avaliacaoId: avaliacao.id, inscricaoId } },
    create: { avaliacaoId: avaliacao.id, inscricaoId, valor },
    update: { valor },
  });
}

// Finaliza uma tentativa dentro de uma transação. Devolve sem fazer nada se já foi enviada.
// Respostas (quando vierem) são gravadas antes da correção automática.
export async function finalizarNaTransacao(
  tx: Tx,
  tentativaId: number,
  agora: Date,
  respostas: RespostaEntrada[] | null
): Promise<void> {
  // A guarda vem primeiro: a linha fica travada e uma segunda chamada não finaliza de novo.
  const guarda = await tx.provaTentativa.updateMany({
    where: { id: tentativaId, enviadaEm: null },
    data: { enviadaEm: agora },
  });
  if (guarda.count === 0) return;

  const tentativa = await tx.provaTentativa.findUniqueOrThrow({
    where: { id: tentativaId },
    include: { prova: { include: { questoes: { orderBy: { ordem: 'asc' } } } } },
  });
  const prova = tentativa.prova;

  if (respostas !== null) {
    await gravarRespostas(tx, tentativaId, prova.questoes, respostas);
  }

  const linhas = await tx.provaResposta.findMany({ where: { tentativaId } });
  const porQuestao = new Map(linhas.map((l) => [l.questaoId, l]));

  let pontosAuto = 0;
  let temDissertativa = false;
  let total = 0;
  for (const q of prova.questoes) {
    total += q.pontos;
    const linha = porQuestao.get(q.id);
    if (q.tipo === 'DISSERTATIVA') {
      temDissertativa = true;
      if (!linha) {
        await tx.provaResposta.create({ data: { tentativaId, questaoId: q.id, alternativa: null, texto: '', pontos: null } });
      }
      continue;
    }
    const acertou = linha !== undefined && linha.alternativa !== null && q.correta !== null && linha.alternativa === q.correta;
    const pontos = acertou ? q.pontos : 0;
    pontosAuto += pontos;
    if (linha) {
      await tx.provaResposta.update({ where: { id: linha.id }, data: { pontos } });
    } else {
      await tx.provaResposta.create({ data: { tentativaId, questaoId: q.id, alternativa: null, texto: '', pontos } });
    }
  }

  const corrigida = !temDissertativa;
  const notaFinal = corrigida ? (total > 0 ? arredondar2((pontosAuto / total) * prova.notaMaxima) : 0) : null;
  await tx.provaTentativa.update({
    where: { id: tentativaId },
    data: { notaObjetiva: arredondar2(pontosAuto), corrigida, notaFinal },
  });
  if (corrigida && notaFinal !== null) {
    await gravarNotaNoDiario(tx, prova, tentativa.inscricaoId, notaFinal);
  }
}

// Depois do commit: se a tentativa ficou corrigida e a prova está ligada a uma avaliação,
// recalcula a média final da inscrição (como a correção de tarefa faz).
export async function recalcularNotaDaTentativa(tentativaId: number): Promise<void> {
  const t = await prisma.provaTentativa.findUnique({
    where: { id: tentativaId },
    select: { inscricaoId: true, corrigida: true, prova: { select: { avaliacaoId: true } } },
  });
  if (t && t.corrigida && t.prova.avaliacaoId !== null) {
    await recalcularInscricoes([t.inscricaoId]);
  }
}

// Finaliza tentativas vencidas há mais da tolerância (lazy na consulta e tarefa periódica).
export async function finalizarVencidas(filtro: { provaId?: number; turmaId?: number } = {}): Promise<void> {
  const agora = new Date();
  const limite = new Date(agora.getTime() - TOLERANCIA_MS);
  const vencidas = await prisma.provaTentativa.findMany({
    where: {
      enviadaEm: null,
      expiraEm: { lt: limite },
      ...(filtro.provaId !== undefined ? { provaId: filtro.provaId } : {}),
      ...(filtro.turmaId !== undefined ? { prova: { turmaId: filtro.turmaId } } : {}),
    },
    select: { id: true },
    take: 500,
  });
  for (const { id } of vencidas) {
    try {
      await prisma.$transaction((tx) => finalizarNaTransacao(tx, id, new Date(), null));
      await recalcularNotaDaTentativa(id);
    } catch (erro) {
      console.error('Falha ao finalizar prova vencida:', erro instanceof Error ? erro.message : erro);
    }
  }
}

// Detalhe da tentativa para professor e gestão (formato do main, Contrato D).
// Nome e RA do aluno dono de uma inscrição (sem e-mail, CPF ou telefone).
export async function alunoDaInscricao(inscricaoId: number): Promise<{ usuarioId: number; nome: string; ra: string }> {
  const inscricao = await prisma.inscricao.findUniqueOrThrow({
    where: { id: inscricaoId },
    select: { matricula: { select: { aluno: { select: { ra: true, usuarioId: true, usuario: { select: { nome: true } } } } } } },
  });
  const aluno = inscricao.matricula.aluno;
  return { usuarioId: aluno.usuarioId, nome: aluno.usuario.nome, ra: aluno.ra };
}

export async function detalheTentativa(id: number) {
  const tentativa = await prisma.provaTentativa.findUnique({
    where: { id },
    include: {
      prova: { include: { questoes: { orderBy: { ordem: 'asc' } } } },
      respostas: true,
    },
  });
  if (!tentativa) throw new HttpError(404, 'Tentativa não encontrada');
  const aluno = await alunoDaInscricao(tentativa.inscricaoId);
  const porQuestao = new Map(tentativa.respostas.map((r) => [r.questaoId, r]));
  return {
    id: tentativa.id,
    provaId: tentativa.provaId,
    aluno: { nome: aluno.nome, ra: aluno.ra },
    iniciadaEm: iso(tentativa.iniciadaEm),
    enviadaEm: tentativa.enviadaEm ? iso(tentativa.enviadaEm) : null,
    corrigida: tentativa.corrigida,
    notaObjetiva: tentativa.notaObjetiva,
    notaFinal: tentativa.notaFinal,
    questoes: tentativa.prova.questoes.map((q, indice) => {
      const r = porQuestao.get(q.id);
      const dissertativa = q.tipo === 'DISSERTATIVA';
      return {
        questaoId: q.id,
        ordem: indice + 1,
        tipo: q.tipo,
        enunciado: q.enunciado,
        alternativas: listaAlternativas(q.alternativas),
        correta: dissertativa ? null : q.correta,
        minhaAlternativa: r?.alternativa ?? null,
        meuTexto: r?.texto ?? '',
        pontos: q.pontos,
        pontosObtidos: dissertativa ? (r?.pontos ?? null) : (r?.pontos ?? 0),
        comentario: r?.comentario ?? '',
      };
    }),
  };
}
