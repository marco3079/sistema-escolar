import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import {
  AcessoTurma,
  acessoDeAluno,
  acessoDeEdicao,
  acessoTurma,
  usuariosDosAlunosDaTurma,
} from '../../lib/turmas';
import { notificar } from '../../lib/notificacoes';
import { ArquivoDTO, apagarArquivosDe, arquivosDe, definirArquivos } from '../../lib/arquivos';
import { recalcularInscricoes } from '../diario/calculo';

const router = Router();

const SEM_PERMISSAO = 'Sem permissão';

// ---------- Tipos do Contrato C ----------

type Situacao = 'PENDENTE' | 'ENTREGUE' | 'CORRIGIDA' | 'ENCERRADA';

interface EntregaDTO {
  id: number;
  texto: string;
  entregueEm: string;
  atrasada: boolean;
  nota: number | null;
  comentario: string;
  corrigidaEm: string | null;
  arquivos: ArquivoDTO[];
}

interface TarefaDTO {
  id: number;
  titulo: string;
  enunciado: string;
  prazo: string;
  notaMaxima: number;
  aceitaAtraso: boolean;
  avaliacaoId: number | null;
  criadaEm: string;
  arquivos: ArquivoDTO[];
  situacao?: Situacao;
  minhaEntrega?: EntregaDTO | null;
  resumo?: { alunos: number; entregues: number; corrigidas: number };
}

// Campos de Tarefa e TarefaEntrega usados na serialização (o Prisma Client satisfaz estas formas).
interface TarefaRegistro {
  id: number;
  turmaId: number;
  titulo: string;
  enunciado: string;
  prazo: Date;
  notaMaxima: number;
  aceitaAtraso: boolean;
  avaliacaoId: number | null;
  criadaEm: Date;
}

interface EntregaRegistro {
  id: number;
  tarefaId: number;
  inscricaoId: number;
  texto: string;
  entregueEm: Date;
  atrasada: boolean;
  nota: number | null;
  comentario: string;
  corrigidaEm: Date | null;
}

// ---------- Esquemas de entrada ----------

const dataIso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida');

const idsArquivos = z.array(z.number().int().positive()).max(10);

const tarefaSchema = z.object({
  titulo: z.string().trim().min(2).max(120),
  enunciado: z.string().max(10000),
  prazo: dataIso,
  notaMaxima: z.number().min(0.1).max(100),
  aceitaAtraso: z.boolean(),
  avaliacaoId: z.number().int().positive().nullable().optional(),
  arquivoIds: idsArquivos.default([]),
});

const entregaSchema = z.object({
  texto: z.string().max(10000),
  arquivoIds: idsArquivos.default([]),
});

const correcaoSchema = z.object({
  nota: z.number().min(0),
  comentario: z.string().max(2000).default(''),
});

// ---------- Auxiliares ----------

function iso(data: Date): string {
  return data.toISOString();
}

function paraEntrega(entrega: EntregaRegistro, arquivos: ArquivoDTO[]): EntregaDTO {
  return {
    id: entrega.id,
    texto: entrega.texto,
    entregueEm: iso(entrega.entregueEm),
    atrasada: entrega.atrasada,
    nota: entrega.nota,
    comentario: entrega.comentario,
    corrigidaEm: entrega.corrigidaEm ? iso(entrega.corrigidaEm) : null,
    arquivos,
  };
}

function dadosBasicos(tarefa: TarefaRegistro, arquivos: Map<number, ArquivoDTO[]>): TarefaDTO {
  return {
    id: tarefa.id,
    titulo: tarefa.titulo,
    enunciado: tarefa.enunciado,
    prazo: iso(tarefa.prazo),
    notaMaxima: tarefa.notaMaxima,
    aceitaAtraso: tarefa.aceitaAtraso,
    avaliacaoId: tarefa.avaliacaoId,
    criadaEm: iso(tarefa.criadaEm),
    arquivos: arquivos.get(tarefa.id) ?? [],
  };
}

// Situação do aluno, calculada com o relógio do servidor.
function situacaoDoAluno(
  tarefa: TarefaRegistro,
  entrega: EntregaRegistro | undefined,
  agora: Date
): Situacao {
  if (entrega && entrega.corrigidaEm) return 'CORRIGIDA';
  if (entrega) return 'ENTREGUE';
  if (agora.getTime() > tarefa.prazo.getTime() && !tarefa.aceitaAtraso) return 'ENCERRADA';
  return 'PENDENTE';
}

// Monta as tarefas para quem pediu: o aluno vê a própria entrega e a situação;
// professor e gestão veem o resumo da turma (sem nenhuma entrega individual).
async function montarTarefas(acesso: AcessoTurma, tarefas: TarefaRegistro[]): Promise<TarefaDTO[]> {
  if (tarefas.length === 0) return [];
  const turmaId = acesso.turma.id;
  const ids = tarefas.map((t) => t.id);
  const arquivosDasTarefas = await arquivosDe('TAREFA', ids);

  if (acesso.papel === 'ALUNO') {
    if (acesso.inscricaoId === null) throw new HttpError(403, SEM_PERMISSAO);
    const minhas = await prisma.tarefaEntrega.findMany({
      where: { inscricaoId: acesso.inscricaoId, tarefaId: { in: ids } },
    });
    const arquivosDasEntregas = await arquivosDe(
      'ENTREGA',
      minhas.map((e) => e.id)
    );
    const porTarefa = new Map<number, EntregaRegistro>();
    for (const e of minhas) porTarefa.set(e.tarefaId, e);
    const agora = new Date();

    return tarefas.map((t) => {
      const entrega = porTarefa.get(t.id);
      return {
        ...dadosBasicos(t, arquivosDasTarefas),
        situacao: situacaoDoAluno(t, entrega, agora),
        minhaEntrega: entrega ? paraEntrega(entrega, arquivosDasEntregas.get(entrega.id) ?? []) : null,
      };
    });
  }

  // Professor e gestão: contagem só com inscrições ativas (não trancadas).
  const ativas = await prisma.inscricao.findMany({
    where: { turmaId, status: { not: 'TRANCADO' } },
    select: { id: true },
  });
  const ativos = new Set(ativas.map((i) => i.id));
  const entregas = await prisma.tarefaEntrega.findMany({
    where: { tarefaId: { in: ids } },
    select: { tarefaId: true, inscricaoId: true, corrigidaEm: true },
  });
  const contagem = new Map<number, { entregues: number; corrigidas: number }>();
  for (const e of entregas) {
    if (!ativos.has(e.inscricaoId)) continue;
    const atual = contagem.get(e.tarefaId) ?? { entregues: 0, corrigidas: 0 };
    atual.entregues += 1;
    if (e.corrigidaEm) atual.corrigidas += 1;
    contagem.set(e.tarefaId, atual);
  }

  return tarefas.map((t) => {
    const c = contagem.get(t.id) ?? { entregues: 0, corrigidas: 0 };
    return {
      ...dadosBasicos(t, arquivosDasTarefas),
      resumo: { alunos: ativos.size, entregues: c.entregues, corrigidas: c.corrigidas },
    };
  });
}

// Confere que a avaliação do diário existe e é desta turma.
async function conferirAvaliacao(turmaId: number, avaliacaoId: number | null | undefined): Promise<void> {
  if (avaliacaoId === null || avaliacaoId === undefined) return;
  const avaliacao = await prisma.avaliacao.findUnique({
    where: { id: avaliacaoId },
    select: { turmaId: true },
  });
  if (!avaliacao || avaliacao.turmaId !== turmaId) {
    throw new HttpError(400, 'Avaliação não pertence a esta turma');
  }
}

async function carregarTarefa(id: number) {
  const tarefa = await prisma.tarefa.findUnique({ where: { id } });
  if (!tarefa) throw new HttpError(404, 'Tarefa não encontrada');
  return tarefa;
}

// ---------- Rotas ----------

// Avaliações do diário da turma, para ligar a nota da tarefa (edição).
router.get(
  '/salas/:turmaId/avaliacoes',
  asyncHandler(async (req, res) => {
    const acesso = await acessoDeEdicao(req, idParam(req, 'turmaId'));
    const avaliacoes = await prisma.avaliacao.findMany({
      where: { turmaId: acesso.turma.id },
      orderBy: [{ data: 'asc' }, { id: 'asc' }],
      select: { id: true, nome: true, notaMaxima: true },
    });
    res.json(avaliacoes);
  })
);

// Tarefas da turma, da mais recente para a mais antiga.
router.get(
  '/salas/:turmaId/tarefas',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    const acesso = await acessoTurma(req, turmaId);
    const tarefas = await prisma.tarefa.findMany({
      where: { turmaId },
      orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }],
    });
    res.json(await montarTarefas(acesso, tarefas));
  })
);

router.post(
  '/salas/:turmaId/tarefas',
  asyncHandler(async (req, res) => {
    const turmaId = idParam(req, 'turmaId');
    const acesso = await acessoDeEdicao(req, turmaId);
    const dados = validar(tarefaSchema, req.body);
    await conferirAvaliacao(turmaId, dados.avaliacaoId);

    const tarefa = await prisma.tarefa.create({
      data: {
        turmaId,
        titulo: dados.titulo,
        enunciado: dados.enunciado,
        prazo: new Date(dados.prazo),
        notaMaxima: dados.notaMaxima,
        aceitaAtraso: dados.aceitaAtraso,
        avaliacaoId: dados.avaliacaoId ?? null,
        criadoPorId: req.usuario.id,
      },
    });
    try {
      await definirArquivos(req.usuario.id, dados.arquivoIds, 'TAREFA', tarefa.id);
    } catch (erro) {
      await prisma.tarefa.delete({ where: { id: tarefa.id } }).catch(() => undefined);
      throw erro;
    }

    notificar(await usuariosDosAlunosDaTurma(turmaId), {
      tipo: 'AULA',
      titulo: `Nova tarefa em ${acesso.turma.disciplina.nome}: ${tarefa.titulo}`,
      link: `/sala/${turmaId}?aba=tarefas`,
    });

    const [dto] = await montarTarefas(acesso, [tarefa]);
    res.status(201).json(dto);
  })
);

router.put(
  '/tarefas/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await carregarTarefa(id);
    const acesso = await acessoDeEdicao(req, atual.turmaId);
    const dados = validar(tarefaSchema, req.body);
    await conferirAvaliacao(atual.turmaId, dados.avaliacaoId);

    await definirArquivos(req.usuario.id, dados.arquivoIds, 'TAREFA', id);
    const tarefa = await prisma.tarefa.update({
      where: { id },
      data: {
        titulo: dados.titulo,
        enunciado: dados.enunciado,
        prazo: new Date(dados.prazo),
        notaMaxima: dados.notaMaxima,
        aceitaAtraso: dados.aceitaAtraso,
        avaliacaoId: dados.avaliacaoId ?? null,
      },
    });

    const [dto] = await montarTarefas(acesso, [tarefa]);
    res.json(dto);
  })
);

router.delete(
  '/tarefas/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await carregarTarefa(id);
    await acessoDeEdicao(req, atual.turmaId);

    const entregas = await prisma.tarefaEntrega.findMany({ where: { tarefaId: id }, select: { id: true } });
    if (entregas.length > 0) {
      await apagarArquivosDe(
        'ENTREGA',
        entregas.map((e) => e.id)
      );
    }
    await apagarArquivosDe('TAREFA', [id]);
    // As entregas saem junto (cascata).
    await prisma.tarefa.delete({ where: { id } });
    res.status(204).end();
  })
);

// Todos os alunos da turma (sem trancados), com a entrega de cada um (ou null).
router.get(
  '/tarefas/:id/entregas',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const tarefa = await carregarTarefa(id);
    const acesso = await acessoTurma(req, tarefa.turmaId);
    if (acesso.papel === 'ALUNO') throw new HttpError(403, SEM_PERMISSAO);

    const inscricoes = await prisma.inscricao.findMany({
      where: { turmaId: tarefa.turmaId, status: { not: 'TRANCADO' } },
      select: {
        id: true,
        matricula: {
          select: { aluno: { select: { ra: true, usuario: { select: { nome: true } } } } },
        },
      },
    });
    const entregas = await prisma.tarefaEntrega.findMany({ where: { tarefaId: id } });
    const arquivosDasEntregas = await arquivosDe(
      'ENTREGA',
      entregas.map((e) => e.id)
    );
    const porInscricao = new Map<number, EntregaRegistro>();
    for (const e of entregas) porInscricao.set(e.inscricaoId, e);

    const lista = inscricoes
      .map((i) => {
        const entrega = porInscricao.get(i.id);
        return {
          inscricaoId: i.id,
          aluno: { nome: i.matricula.aluno.usuario.nome, ra: i.matricula.aluno.ra },
          entrega: entrega ? paraEntrega(entrega, arquivosDasEntregas.get(entrega.id) ?? []) : null,
        };
      })
      .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
    res.json(lista);
  })
);

// Entrega do aluno: cria ou substitui enquanto não foi corrigida.
router.put(
  '/tarefas/:id/entrega',
  asyncHandler(async (req, res) => {
    const tarefaId = idParam(req);
    const tarefa = await carregarTarefa(tarefaId);
    const acesso = await acessoDeAluno(req, tarefa.turmaId);
    const dados = validar(entregaSchema, req.body);
    if (dados.texto.trim() === '' && dados.arquivoIds.length === 0) {
      throw new HttpError(400, 'Informe um texto ou um arquivo');
    }

    const agora = new Date();
    const atrasada = agora.getTime() > tarefa.prazo.getTime();
    if (atrasada && !tarefa.aceitaAtraso) {
      throw new HttpError(409, 'O prazo desta tarefa já terminou');
    }

    const anterior = await prisma.tarefaEntrega.findUnique({
      where: { tarefaId_inscricaoId: { tarefaId, inscricaoId: acesso.inscricaoId } },
    });
    if (anterior && anterior.corrigidaEm) {
      throw new HttpError(409, 'Esta entrega já foi corrigida');
    }

    let entregaId: number;
    if (anterior) {
      // Arquivos antes do texto: um anexo inválido (400) não deixa o texto novo gravado.
      entregaId = anterior.id;
      await definirArquivos(req.usuario.id, dados.arquivoIds, 'ENTREGA', entregaId);
      const r = await prisma.tarefaEntrega.updateMany({
        where: { id: anterior.id, corrigidaEm: null },
        data: { texto: dados.texto, entregueEm: agora, atrasada },
      });
      if (r.count === 0) throw new HttpError(409, 'Esta entrega já foi corrigida');
    } else {
      const criada = await prisma.tarefaEntrega.create({
        data: {
          tarefaId,
          inscricaoId: acesso.inscricaoId,
          texto: dados.texto,
          entregueEm: agora,
          atrasada,
        },
      });
      entregaId = criada.id;
      try {
        await definirArquivos(req.usuario.id, dados.arquivoIds, 'ENTREGA', entregaId);
      } catch (erro) {
        await prisma.tarefaEntrega.delete({ where: { id: entregaId } }).catch(() => undefined);
        throw erro;
      }
    }

    const registro = await prisma.tarefaEntrega.findUnique({ where: { id: entregaId } });
    if (!registro) throw new HttpError(404, 'Entrega não encontrada');
    const arquivos = await arquivosDe('ENTREGA', [entregaId]);
    res.json(paraEntrega(registro, arquivos.get(entregaId) ?? []));
  })
);

// Correção (edição): grava nota e comentário e, se a tarefa tem avaliação, a nota do diário, na mesma transação.
router.put(
  '/entregas/:id/correcao',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const entrega = await prisma.tarefaEntrega.findUnique({
      where: { id },
      include: { tarefa: true },
    });
    if (!entrega) throw new HttpError(404, 'Entrega não encontrada');
    const tarefa = entrega.tarefa;
    await acessoDeEdicao(req, tarefa.turmaId);
    const dados = validar(correcaoSchema, req.body);
    if (dados.nota > tarefa.notaMaxima) {
      throw new HttpError(400, `Nota deve estar entre 0 e ${tarefa.notaMaxima}`);
    }

    let avaliacao: { id: number; notaMaxima: number } | null = null;
    if (tarefa.avaliacaoId !== null) {
      avaliacao = await prisma.avaliacao.findUnique({
        where: { id: tarefa.avaliacaoId },
        select: { id: true, notaMaxima: true },
      });
      if (!avaliacao) {
        throw new HttpError(409, 'A avaliação do diário ligada a esta tarefa não existe mais');
      }
    }
    const valorDiario =
      avaliacao !== null
        ? Math.round(dados.nota * (avaliacao.notaMaxima / tarefa.notaMaxima) * 100) / 100
        : null;

    const agora = new Date();
    const atualizada = await prisma.$transaction(async (tx) => {
      const e = await tx.tarefaEntrega.update({
        where: { id },
        data: {
          nota: dados.nota,
          comentario: dados.comentario,
          corrigidaEm: agora,
          corrigidaPorId: req.usuario.id,
        },
      });
      if (avaliacao !== null && valorDiario !== null) {
        await tx.nota.upsert({
          where: {
            avaliacaoId_inscricaoId: { avaliacaoId: avaliacao.id, inscricaoId: e.inscricaoId },
          },
          create: { avaliacaoId: avaliacao.id, inscricaoId: e.inscricaoId, valor: valorDiario },
          update: { valor: valorDiario },
        });
      }
      return e;
    });

    if (avaliacao !== null) {
      await recalcularInscricoes([atualizada.inscricaoId]);
    }

    const inscricao = await prisma.inscricao.findUnique({
      where: { id: atualizada.inscricaoId },
      select: { matricula: { select: { aluno: { select: { usuarioId: true } } } } },
    });
    if (inscricao) {
      notificar([inscricao.matricula.aluno.usuarioId], {
        tipo: 'AULA',
        titulo: `Tarefa corrigida: ${tarefa.titulo}`,
        link: `/sala/${tarefa.turmaId}?aba=tarefas`,
      });
    }

    const arquivos = await arquivosDe('ENTREGA', [id]);
    res.json(paraEntrega(atualizada, arquivos.get(id) ?? []));
  })
);

export default router;
