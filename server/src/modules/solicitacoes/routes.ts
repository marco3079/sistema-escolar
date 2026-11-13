import { Request, Router } from 'express';
import { z } from 'zod';
import { Prisma, StatusSolicitacao } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { acessoAMatricula, alunosDoResponsavel } from '../../lib/responsaveis';
import { limparCacheConfiguracao, lerConfiguracao } from '../../lib/email';
import { arquivosDe, receberArquivo } from '../../lib/arquivos';
import { emailSchema, lerDataNascimento } from '../cadastros/importacao';
import {
  alterarStatus,
  aprovarSolicitacao,
  avisarRecebimento,
  conferirChave,
  criarComProtocolo,
  EXTENSOES_DOCUMENTO,
  excluirSolicitacao,
  gerarTextoAleatorio,
  HASH_FALSO,
  hashChave,
  incluiCurso,
  LIMITE_DOCUMENTO_BYTES,
  limitarAcompanhamento,
  limitarCriacao,
  limitarDocumentos,
  MAX_DOCUMENTOS_POR_PEDIDO,
  MENSAGEM_LIMITE,
  MENSAGEM_NAO_ENCONTRADO,
  paraDTO,
  paraResumo,
  carregarPedido,
  periodosAbertos,
  protocoloFalso,
  STATUS_ABERTOS,
  STATUS_ENVIO_DOCUMENTOS,
  TAMANHO_CHAVE,
} from './servico';

// Rotas públicas (sem login): matrícula online.
export const publico = Router();

// Rotas autenticadas: rematrícula (aluno e responsável) e secretaria.
const router = Router();

const MAX_LINHAS_LISTA = 30;

// ---------- Utilitários ----------

function textoOpcional(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres`)
    .nullish()
    .transform((valor) => (valor ? valor : null));
}

const emailOpcional = z
  .union([z.literal(''), emailSchema])
  .nullish()
  .transform((valor) => (valor ? valor : null));

function cabecalhoTexto(req: Request, nome: string): string {
  const valor = req.headers[nome];
  return typeof valor === 'string' ? valor.trim() : '';
}

// Data de nascimento: aceita dd/mm/aaaa ou aaaa-mm-dd. Futuro ou mais de 120 anos: 400.
function conferirNascimento(valor: string): Date {
  const iso = lerDataNascimento(valor);
  if (!iso) throw new HttpError(400, 'Data de nascimento inválida');
  const data = new Date(`${iso}T00:00:00.000Z`);
  const agora = new Date();
  if (data.getTime() > agora.getTime()) {
    throw new HttpError(400, 'A data de nascimento não pode estar no futuro');
  }
  const limiteInferior = new Date(Date.UTC(agora.getUTCFullYear() - 120, agora.getUTCMonth(), agora.getUTCDate()));
  if (data.getTime() < limiteInferior.getTime()) {
    throw new HttpError(400, 'Data de nascimento inválida');
  }
  return data;
}

// Menor de 18 anos (contado em UTC, como a data é gravada).
function eMenorDeIdade(nascimento: Date): boolean {
  const dezoito = new Date(
    Date.UTC(nascimento.getUTCFullYear() + 18, nascimento.getUTCMonth(), nascimento.getUTCDate())
  );
  return Date.now() < dezoito.getTime();
}

function opcaoQuery<T extends string>(valor: unknown, lista: readonly T[]): T | undefined {
  if (valor === undefined || valor === '') return undefined;
  if (typeof valor === 'string' && (lista as readonly string[]).includes(valor)) return valor as T;
  throw new HttpError(400, 'Filtro inválido');
}

function paginaQuery(valor: unknown): number {
  if (valor === undefined || valor === '') return 1;
  if (typeof valor === 'string' && /^\d{1,6}$/.test(valor) && Number(valor) >= 1) return Number(valor);
  throw new HttpError(400, 'Página inválida');
}

async function alunosDoRequisitante(req: Request): Promise<number[]> {
  const { perfil, alunoId, id } = req.usuario;
  if (perfil === 'ALUNO') return alunoId === null ? [] : [alunoId];
  if (perfil === 'RESPONSAVEL') return alunosDoResponsavel(id);
  return [];
}

// ---------- Schemas (zod) ----------

const pedidoMatriculaSchema = z.object({
  cursoId: z.number().int().positive(),
  periodoLetivoId: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((valor) => valor ?? null),
  nome: z.string().trim().min(1, 'Informe o nome').max(150, 'O nome pode ter até 150 caracteres'),
  email: emailSchema,
  cpf: textoOpcional(20),
  dataNascimento: z.string().trim().min(1, 'Informe a data de nascimento'),
  telefone: textoOpcional(30),
  endereco: textoOpcional(300),
  responsavelNome: textoOpcional(150),
  responsavelEmail: emailOpcional,
  responsavelTelefone: textoOpcional(30),
  responsavelParentesco: textoOpcional(60),
  observacao: textoOpcional(2000),
  // Armadilha para robôs: campo oculto, deve ficar vazio.
  site: z.unknown().optional(),
});

const acompanharSchema = z.object({
  protocolo: z.string().max(200),
  chave: z.string().max(200),
});

const rematriculaSchema = z.object({
  matriculaId: z.number().int().positive(),
  periodoLetivoId: z.number().int().positive(),
  observacao: textoOpcional(2000),
});

const statusSchema = z.object({
  status: z.enum(['EM_ANALISE', 'PENDENTE', 'RECUSADA']),
  parecer: z.string().trim().max(2000, 'O parecer pode ter até 2000 caracteres').optional(),
});

const aprovarSchema = z.object({
  parecer: z.string().trim().max(2000, 'O parecer pode ter até 2000 caracteres').optional(),
  avancarSerie: z.boolean().optional(),
  criarResponsavel: z.boolean().optional(),
});

const configuracaoSchema = z.object({
  aberta: z.boolean(),
  texto: z.string().trim().max(2000, 'O texto pode ter até 2000 caracteres'),
});

const STATUS_LISTA = ['ENVIADA', 'EM_ANALISE', 'PENDENTE', 'APROVADA', 'RECUSADA'] as const;
const TIPO_LISTA = ['NOVA', 'REMATRICULA'] as const;

// ---------- Matrícula online (público) ----------

publico.get(
  '/matricula-online',
  asyncHandler(async (_req, res) => {
    const configuracao = await lerConfiguracao();
    const aberta = configuracao.matriculaOnlineAberta;
    const cursos = aberta
      ? await prisma.curso.findMany({
          where: { ativo: true },
          select: { id: true, nome: true, nivel: true, regime: true, mensalidade: true },
          orderBy: { nome: 'asc' },
        })
      : [];
    const periodos = aberta ? await periodosAbertos() : [];
    res.json({ aberta, texto: configuracao.matriculaOnlineTexto, cursos, periodos });
  })
);

publico.post(
  '/matricula-online',
  asyncHandler(async (req, res) => {
    if (!limitarCriacao(req.ip ?? '')) throw new HttpError(429, MENSAGEM_LIMITE);
    const configuracao = await lerConfiguracao();
    if (!configuracao.matriculaOnlineAberta) {
      throw new HttpError(403, 'A matrícula online está fechada no momento');
    }
    const dados = validar(pedidoMatriculaSchema, req.body);

    // Armadilha: responde como se tivesse gravado, mas não grava nada.
    if (dados.site !== undefined && dados.site !== null && String(dados.site).trim() !== '') {
      res.status(201).json({
        protocolo: protocoloFalso(),
        chave: gerarTextoAleatorio(TAMANHO_CHAVE),
      });
      return;
    }

    const nascimento = conferirNascimento(dados.dataNascimento);
    if (eMenorDeIdade(nascimento) && (!dados.responsavelNome || !dados.responsavelEmail)) {
      throw new HttpError(400, 'Para menores de 18 anos, informe o nome e o e-mail do responsável');
    }

    const curso = await prisma.curso.findFirst({
      where: { id: dados.cursoId, ativo: true },
      select: { id: true },
    });
    if (!curso) throw new HttpError(400, 'Curso indisponível');
    if (dados.periodoLetivoId !== null) {
      const abertos = await periodosAbertos();
      if (!abertos.some((periodo) => periodo.id === dados.periodoLetivoId)) {
        throw new HttpError(400, 'Período letivo indisponível');
      }
    }

    const emAndamento = await prisma.solicitacaoMatricula.findFirst({
      where: {
        email: { equals: dados.email, mode: 'insensitive' },
        cursoId: curso.id,
        status: { in: STATUS_ABERTOS },
      },
      select: { id: true },
    });
    if (emAndamento) {
      throw new HttpError(409, 'Já existe um pedido em andamento para este curso com este e-mail');
    }

    const chave = gerarTextoAleatorio(TAMANHO_CHAVE);
    const pedido = await criarComProtocolo({
      tipo: 'NOVA',
      chaveHash: hashChave(chave),
      cursoId: curso.id,
      periodoLetivoId: dados.periodoLetivoId,
      nome: dados.nome,
      email: dados.email,
      cpf: dados.cpf,
      dataNascimento: nascimento,
      telefone: dados.telefone,
      endereco: dados.endereco,
      responsavelNome: dados.responsavelNome,
      responsavelEmail: dados.responsavelEmail,
      responsavelTelefone: dados.responsavelTelefone,
      responsavelParentesco: dados.responsavelParentesco,
      observacao: dados.observacao ?? '',
    });
    avisarRecebimento(pedido);
    res.status(201).json({ protocolo: pedido.protocolo, chave });
  })
);

publico.post(
  '/matricula-online/acompanhar',
  asyncHandler(async (req, res) => {
    if (!limitarAcompanhamento(req.ip ?? '')) throw new HttpError(429, MENSAGEM_LIMITE);
    const { protocolo, chave } = validar(acompanharSchema, req.body);
    const pedido = await prisma.solicitacaoMatricula.findUnique({
      where: { protocolo: protocolo.trim() },
      include: incluiCurso,
    });
    // Confere sempre (mesmo sem pedido) para o tempo de resposta não revelar o protocolo.
    const confere = conferirChave(chave, pedido?.chaveHash ?? HASH_FALSO);
    if (!pedido || pedido.tipo !== 'NOVA' || !confere) {
      throw new HttpError(404, MENSAGEM_NAO_ENCONTRADO);
    }
    const documentos = (await arquivosDe('SOLICITACAO', [pedido.id])).get(pedido.id) ?? [];
    res.json({
      protocolo: pedido.protocolo,
      tipo: pedido.tipo,
      status: pedido.status,
      nome: pedido.nome,
      curso: { id: pedido.curso.id, nome: pedido.curso.nome, nivel: pedido.curso.nivel },
      criadoEm: pedido.criadoEm.toISOString(),
      parecer: pedido.parecer,
      documentos: documentos.map((arquivo) => ({ nome: arquivo.nome, tamanho: arquivo.tamanho })),
      podeEnviarDocumentos:
        STATUS_ENVIO_DOCUMENTOS.includes(pedido.status) && documentos.length < MAX_DOCUMENTOS_POR_PEDIDO,
    });
  })
);

publico.post(
  '/matricula-online/documentos',
  asyncHandler(async (req, res) => {
    if (!limitarDocumentos(req.ip ?? '')) throw new HttpError(429, MENSAGEM_LIMITE);
    // Protocolo e chave conferidos ANTES de ler o corpo do arquivo.
    const protocolo = cabecalhoTexto(req, 'x-protocolo');
    const chave = cabecalhoTexto(req, 'x-chave');
    const pedido = protocolo
      ? await prisma.solicitacaoMatricula.findUnique({
          where: { protocolo },
          select: { id: true, tipo: true, status: true, chaveHash: true },
        })
      : null;
    const confere = conferirChave(chave, pedido?.chaveHash ?? HASH_FALSO);
    if (!pedido || pedido.tipo !== 'NOVA' || !confere) {
      throw new HttpError(404, MENSAGEM_NAO_ENCONTRADO);
    }
    if (!STATUS_ENVIO_DOCUMENTOS.includes(pedido.status)) {
      throw new HttpError(409, 'Os documentos não podem ser enviados nesta fase do pedido');
    }
    const enviados = await prisma.arquivo.count({
      where: { contexto: 'SOLICITACAO', contextoId: pedido.id },
    });
    if (enviados >= MAX_DOCUMENTOS_POR_PEDIDO) {
      throw new HttpError(400, `Cada pedido aceita até ${MAX_DOCUMENTOS_POR_PEDIDO} documentos`);
    }
    const arquivo = await receberArquivo(req, {
      donoId: 0,
      contexto: 'SOLICITACAO',
      contextoId: pedido.id,
      limiteBytes: LIMITE_DOCUMENTO_BYTES,
      extensoes: EXTENSOES_DOCUMENTO,
    });
    res.status(201).json({ nome: arquivo.nome, tamanho: arquivo.tamanho });
  })
);

// ---------- Rematrícula (aluno e responsável) ----------

router.get(
  '/rematricula/opcoes',
  asyncHandler(async (req, res) => {
    const ids = await alunosDoRequisitante(req);
    const matriculas =
      ids.length === 0
        ? []
        : await prisma.matricula.findMany({
            where: { alunoId: { in: ids }, status: { in: ['ATIVA', 'TRANCADA'] } },
            orderBy: { id: 'asc' },
            select: {
              id: true,
              alunoId: true,
              serieAtual: true,
              status: true,
              curso: { select: { id: true, nome: true, nivel: true } },
              aluno: { select: { usuario: { select: { nome: true } } } },
            },
          });
    if (matriculas.length === 0) {
      res.json([]);
      return;
    }
    const periodos = await periodosAbertos();
    const pedidos = await prisma.solicitacaoMatricula.findMany({
      where: {
        tipo: 'REMATRICULA',
        status: { in: STATUS_ABERTOS },
        matriculaId: { in: matriculas.map((matricula) => matricula.id) },
      },
      orderBy: { id: 'desc' },
      select: { matriculaId: true, protocolo: true, status: true },
    });
    const abertoPorMatricula = new Map<number, { protocolo: string; status: StatusSolicitacao }>();
    for (const pedido of pedidos) {
      if (pedido.matriculaId !== null && !abertoPorMatricula.has(pedido.matriculaId)) {
        abertoPorMatricula.set(pedido.matriculaId, { protocolo: pedido.protocolo, status: pedido.status });
      }
    }
    res.json(
      matriculas.map((matricula) => ({
        matriculaId: matricula.id,
        alunoId: matricula.alunoId,
        alunoNome: matricula.aluno.usuario.nome,
        curso: matricula.curso,
        serieAtual: matricula.serieAtual,
        status: matricula.status,
        periodos,
        pedidoAberto: abertoPorMatricula.get(matricula.id) ?? null,
      }))
    );
  })
);

router.post(
  '/rematricula',
  asyncHandler(async (req, res) => {
    const dados = validar(rematriculaSchema, req.body);
    const acesso = await acessoAMatricula(req, dados.matriculaId);
    if (acesso.papel === 'GESTAO') {
      throw new HttpError(403, 'A rematrícula é feita pelo aluno ou pelo responsável');
    }
    const matricula = await prisma.matricula.findUnique({
      where: { id: dados.matriculaId },
      include: { aluno: { include: { usuario: true } } },
    });
    if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');
    if (matricula.status !== 'ATIVA' && matricula.status !== 'TRANCADA') {
      throw new HttpError(409, 'Só matrículas ativas ou trancadas podem ser renovadas');
    }
    const periodos = await periodosAbertos();
    if (!periodos.some((periodo) => periodo.id === dados.periodoLetivoId)) {
      throw new HttpError(400, 'Período letivo indisponível para a rematrícula');
    }
    const aberto = await prisma.solicitacaoMatricula.findFirst({
      where: { matriculaId: matricula.id, tipo: 'REMATRICULA', status: { in: STATUS_ABERTOS } },
      select: { id: true },
    });
    if (aberto) {
      throw new HttpError(409, 'Já existe um pedido de rematrícula em andamento para esta matrícula');
    }

    const { aluno } = matricula;
    const { usuario } = aluno;
    // Chave gerada e descartada: a rematrícula é acompanhada pelo portal, não por chave.
    const pedido = await criarComProtocolo({
      tipo: 'REMATRICULA',
      chaveHash: hashChave(gerarTextoAleatorio(TAMANHO_CHAVE)),
      cursoId: matricula.cursoId,
      periodoLetivoId: dados.periodoLetivoId,
      nome: usuario.nome,
      email: usuario.email,
      cpf: usuario.cpf,
      dataNascimento: aluno.dataNascimento,
      telefone: usuario.telefone,
      endereco: aluno.endereco,
      observacao: dados.observacao ?? '',
      alunoId: aluno.id,
      matriculaId: matricula.id,
      solicitanteId: req.usuario.id,
    });
    res.status(201).json(paraResumo(pedido, 0));
  })
);

router.get(
  '/rematricula/minhas',
  asyncHandler(async (req, res) => {
    const pedidos = await prisma.solicitacaoMatricula.findMany({
      where: { solicitanteId: req.usuario.id },
      include: incluiCurso,
      orderBy: { criadoEm: 'desc' },
    });
    const documentos = await arquivosDe(
      'SOLICITACAO',
      pedidos.map((pedido) => pedido.id)
    );
    res.json(
      pedidos.map((pedido) => ({
        ...paraResumo(pedido, documentos.get(pedido.id)?.length ?? 0),
        parecer: pedido.parecer,
      }))
    );
  })
);

// ---------- Secretaria ----------

router.get(
  '/solicitacoes',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const status = opcaoQuery(req.query.status, STATUS_LISTA);
    const tipo = opcaoQuery(req.query.tipo, TIPO_LISTA);
    const busca = typeof req.query.busca === 'string' ? req.query.busca.trim().slice(0, 100) : '';
    const pagina = paginaQuery(req.query.pagina);

    const base: Prisma.SolicitacaoMatriculaWhereInput = {
      ...(tipo ? { tipo } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: 'insensitive' } },
              { email: { contains: busca, mode: 'insensitive' } },
              { protocolo: { contains: busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const where: Prisma.SolicitacaoMatriculaWhereInput = status ? { ...base, status } : base;

    const [total, itens, contagemBruta] = await Promise.all([
      prisma.solicitacaoMatricula.count({ where }),
      prisma.solicitacaoMatricula.findMany({
        where,
        include: incluiCurso,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * MAX_LINHAS_LISTA,
        take: MAX_LINHAS_LISTA,
      }),
      prisma.solicitacaoMatricula.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
    ]);

    const contagem = Object.fromEntries(STATUS_LISTA.map((valor) => [valor, 0])) as Record<StatusSolicitacao, number>;
    for (const linha of contagemBruta) {
      contagem[linha.status] = linha._count._all;
    }
    const documentos = await arquivosDe(
      'SOLICITACAO',
      itens.map((pedido) => pedido.id)
    );
    res.json({
      itens: itens.map((pedido) => paraResumo(pedido, documentos.get(pedido.id)?.length ?? 0)),
      total,
      pagina,
      porPagina: MAX_LINHAS_LISTA,
      contagem,
    });
  })
);

router.get(
  '/solicitacoes/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const pedido = await carregarPedido(idParam(req));
    if (!pedido) throw new HttpError(404, 'Solicitação não encontrada');
    res.json(await paraDTO(pedido));
  })
);

router.put(
  '/solicitacoes/:id/status',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(statusSchema, req.body);
    res.json(await alterarStatus(id, dados.status, dados.parecer));
  })
);

router.post(
  '/solicitacoes/:id/aprovar',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const corpo = validar(aprovarSchema, req.body ?? {});
    res.json(await aprovarSolicitacao(id, req.usuario.id, corpo));
  })
);

router.delete(
  '/solicitacoes/:id',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    await excluirSolicitacao(idParam(req));
    res.status(204).end();
  })
);

router.put(
  '/matricula-online/configuracao',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(configuracaoSchema, req.body);
    await prisma.configuracaoPlataforma.upsert({
      where: { id: 1 },
      create: { id: 1, matriculaOnlineAberta: dados.aberta, matriculaOnlineTexto: dados.texto },
      update: { matriculaOnlineAberta: dados.aberta, matriculaOnlineTexto: dados.texto },
    });
    limparCacheConfiguracao();
    res.json({ aberta: dados.aberta, texto: dados.texto });
  })
);

export default router;
