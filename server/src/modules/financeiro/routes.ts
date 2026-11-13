import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { notificar } from '../../lib/notificacoes';

const router = Router();

// Inclusão padrão de matrícula no formato MensalidadeDTO / bolsas (sem senhaHash)
const INCLUIR_MATRICULA = {
  matricula: {
    select: {
      id: true,
      aluno: { select: { ra: true, usuario: { select: { nome: true } } } },
      curso: { select: { nome: true } },
    },
  },
};

const STATUS_MENSALIDADE = ['ABERTA', 'PAGA', 'ATRASADA', 'CANCELADA'] as const;

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Acrescenta valorFinal = valor - desconto (nunca negativo, 2 casas)
function paraDTO<T extends { valor: number; desconto: number }>(
  m: T
): T & { valorFinal: number } {
  return { ...m, valorFinal: arredondar2(Math.max(0, m.valor - m.desconto)) };
}

// Avisos no sino ao aluno da matrícula. Em segundo plano: nunca atrasam nem derrubam a resposta.
function avisarMensalidades(matriculaId: number, competencias: string[]): void {
  void (async () => {
    const matricula = await prisma.matricula.findUnique({
      where: { id: matriculaId },
      select: { aluno: { select: { usuarioId: true } } },
    });
    if (!matricula) {
      return;
    }
    const geradas = await prisma.mensalidade.findMany({
      where: { matriculaId, competencia: { in: competencias } },
      select: { id: true, competencia: true },
    });
    for (const m of geradas) {
      notificar([matricula.aluno.usuarioId], {
        tipo: 'FINANCEIRO',
        titulo: `Nova mensalidade de ${m.competencia}`,
        link: '/financeiro',
        chave: `mensalidade:${m.id}`,
      });
    }
  })().catch(() => undefined);
}

function avisarPagamento(matriculaId: number, competencia: string): void {
  void (async () => {
    const matricula = await prisma.matricula.findUnique({
      where: { id: matriculaId },
      select: { aluno: { select: { usuarioId: true } } },
    });
    if (!matricula) {
      return;
    }
    notificar([matricula.aluno.usuarioId], {
      tipo: 'FINANCEIRO',
      titulo: `Pagamento confirmado: ${competencia}`,
      link: '/financeiro',
    });
  })().catch(() => undefined);
}

// Marca como ATRASADA toda mensalidade ABERTA com vencimento anterior a hoje
async function marcarAtrasadas(): Promise<void> {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  await prisma.mensalidade.updateMany({
    where: { status: 'ABERTA', vencimento: { lt: inicioDoDia } },
    data: { status: 'ATRASADA' },
  });
}

// Query string vazia (ex.: ?status=) conta como ausente
function semVazios(q: unknown): Record<string, unknown> {
  const origem = (q ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(origem).filter(([, v]) => v !== ''));
}

const dataSchema = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida');

// ---------- Mensalidades ----------

const filtroMensalidadesSchema = z.object({
  matriculaId: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUS_MENSALIDADE).optional(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Competência deve ser AAAA-MM').optional(),
});

const gerarSchema = z
  .object({
    matriculaId: z.number().int().positive(),
    ano: z.number().int().positive(),
    mesInicial: z.number().int().min(1).max(12),
    mesFinal: z.number().int().min(1).max(12),
    diaVencimento: z.number().int().min(1).max(28),
  })
  .refine((d) => d.mesInicial <= d.mesFinal, {
    message: 'mesInicial deve ser menor ou igual a mesFinal',
    path: ['mesFinal'],
  });

const pagarSchema = z.object({
  formaPagamento: z.string().min(1),
});

// Maior percentual de bolsa ativa e vigente na data (inicio <= data e fim nulo ou >= data)
function maiorPercentualVigente(
  bolsas: { inicio: Date; fim: Date | null; percentual: number }[],
  data: Date
): number {
  let maior = 0;
  for (const b of bolsas) {
    const vigente = b.inicio.getTime() <= data.getTime() && (b.fim === null || b.fim.getTime() >= data.getTime());
    if (vigente && b.percentual > maior) maior = b.percentual;
  }
  return maior;
}

router.get(
  '/mensalidades/minhas',
  permitir('ALUNO'),
  asyncHandler(async (req, res) => {
    const alunoId = req.usuario.alunoId;
    if (alunoId === null) {
      throw new HttpError(403, 'Sem permissão');
    }
    await marcarAtrasadas();
    const lista = await prisma.mensalidade.findMany({
      where: { matricula: { alunoId } },
      include: INCLUIR_MATRICULA,
      orderBy: [{ vencimento: 'asc' }, { id: 'asc' }],
    });
    res.json(lista.map((m) => paraDTO(m)));
  })
);

router.post(
  '/mensalidades/gerar',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(gerarSchema, req.body);

    const matricula = await prisma.matricula.findUnique({
      where: { id: dados.matriculaId },
      include: { curso: true },
    });
    if (!matricula) {
      throw new HttpError(404, 'Matrícula não encontrada');
    }
    const valor = matricula.curso.mensalidade;
    if (valor <= 0) {
      throw new HttpError(409, 'Curso sem mensalidade definida');
    }

    const bolsas = await prisma.bolsa.findMany({
      where: { matriculaId: matricula.id, ativa: true },
    });

    const linhas: {
      matriculaId: number;
      competencia: string;
      vencimento: Date;
      valor: number;
      desconto: number;
    }[] = [];
    for (let mes = dados.mesInicial; mes <= dados.mesFinal; mes++) {
      const vencimento = new Date(dados.ano, mes - 1, dados.diaVencimento);
      const percentual = maiorPercentualVigente(bolsas, vencimento);
      linhas.push({
        matriculaId: matricula.id,
        competencia: `${String(dados.ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`,
        vencimento,
        valor,
        desconto: (valor * percentual) / 100,
      });
    }

    const resultado = await prisma.mensalidade.createMany({
      data: linhas,
      skipDuplicates: true,
    });
    avisarMensalidades(
      matricula.id,
      linhas.map((l) => l.competencia)
    );
    res.status(201).json({ criadas: resultado.count });
  })
);

router.get(
  '/mensalidades',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const filtro = validar(filtroMensalidadesSchema, semVazios(req.query));
    await marcarAtrasadas();
    const lista = await prisma.mensalidade.findMany({
      where: {
        matriculaId: filtro.matriculaId,
        status: filtro.status,
        competencia: filtro.competencia,
      },
      include: INCLUIR_MATRICULA,
      orderBy: [{ vencimento: 'asc' }, { id: 'asc' }],
    });
    res.json(lista.map((m) => paraDTO(m)));
  })
);

router.post(
  '/mensalidades/:id/pagar',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const { formaPagamento } = validar(pagarSchema, req.body);
    const atual = await prisma.mensalidade.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Mensalidade não encontrada');
    }
    if (atual.status === 'PAGA') {
      throw new HttpError(409, 'Mensalidade já está paga');
    }
    if (atual.status === 'CANCELADA') {
      throw new HttpError(409, 'Mensalidade cancelada não pode ser paga');
    }
    const atualizada = await prisma.mensalidade.update({
      where: { id },
      data: { status: 'PAGA', pagoEm: new Date(), formaPagamento },
      include: INCLUIR_MATRICULA,
    });
    avisarPagamento(atualizada.matriculaId, atualizada.competencia);
    res.json(paraDTO(atualizada));
  })
);

router.post(
  '/mensalidades/:id/cancelar',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await prisma.mensalidade.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Mensalidade não encontrada');
    }
    if (atual.status === 'PAGA') {
      throw new HttpError(409, 'Mensalidade paga não pode ser cancelada');
    }
    const atualizada = await prisma.mensalidade.update({
      where: { id },
      data: { status: 'CANCELADA' },
      include: INCLUIR_MATRICULA,
    });
    res.json(paraDTO(atualizada));
  })
);

// ---------- Bolsas ----------

const percentualSchema = z.number().gt(0, 'Percentual deve ser maior que 0').lte(100, 'Percentual deve ser até 100');

const criarBolsaSchema = z.object({
  matriculaId: z.number().int().positive(),
  nome: z.string().min(1),
  percentual: percentualSchema,
  inicio: dataSchema,
  fim: dataSchema.nullable().optional(),
});

const atualizarBolsaSchema = z.object({
  nome: z.string().min(1).optional(),
  percentual: percentualSchema.optional(),
  inicio: dataSchema.optional(),
  fim: dataSchema.nullable().optional(),
  ativa: z.boolean().optional(),
});

const filtroBolsasSchema = z.object({
  matriculaId: z.coerce.number().int().positive().optional(),
});

router.get(
  '/bolsas',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const filtro = validar(filtroBolsasSchema, semVazios(req.query));
    const lista = await prisma.bolsa.findMany({
      where: { matriculaId: filtro.matriculaId },
      include: INCLUIR_MATRICULA,
      orderBy: [{ inicio: 'desc' }, { id: 'desc' }],
    });
    res.json(lista);
  })
);

router.post(
  '/bolsas',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(criarBolsaSchema, req.body);
    const matricula = await prisma.matricula.findUnique({ where: { id: dados.matriculaId } });
    if (!matricula) {
      throw new HttpError(404, 'Matrícula não encontrada');
    }
    const bolsa = await prisma.bolsa.create({
      data: {
        matriculaId: dados.matriculaId,
        nome: dados.nome,
        percentual: dados.percentual,
        inicio: new Date(dados.inicio),
        fim: dados.fim ? new Date(dados.fim) : null,
      },
      include: INCLUIR_MATRICULA,
    });
    res.status(201).json(bolsa);
  })
);

router.put(
  '/bolsas/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(atualizarBolsaSchema, req.body);
    const atual = await prisma.bolsa.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Bolsa não encontrada');
    }
    const bolsa = await prisma.bolsa.update({
      where: { id },
      data: {
        nome: dados.nome,
        percentual: dados.percentual,
        inicio: dados.inicio !== undefined ? new Date(dados.inicio) : undefined,
        fim: dados.fim === undefined ? undefined : dados.fim === null ? null : new Date(dados.fim),
        ativa: dados.ativa,
      },
      include: INCLUIR_MATRICULA,
    });
    res.json(bolsa);
  })
);

router.delete(
  '/bolsas/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await prisma.bolsa.findUnique({ where: { id } });
    if (!atual) {
      throw new HttpError(404, 'Bolsa não encontrada');
    }
    await prisma.bolsa.delete({ where: { id } });
    res.status(204).end();
  })
);

// ---------- Resumo ----------

router.get(
  '/financeiro/resumo',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (_req, res) => {
    await marcarAtrasadas();
    const [mensalidades, quantidadeBolsas] = await Promise.all([
      prisma.mensalidade.findMany({ select: { valor: true, desconto: true, status: true } }),
      prisma.bolsa.count({ where: { ativa: true } }),
    ]);

    const somaPorStatus = (status: (typeof STATUS_MENSALIDADE)[number]): number =>
      arredondar2(
        mensalidades
          .filter((m) => m.status === status)
          .reduce((acc, m) => acc + paraDTO(m).valorFinal, 0)
      );

    res.json({
      aberto: somaPorStatus('ABERTA'),
      pago: somaPorStatus('PAGA'),
      atrasado: somaPorStatus('ATRASADA'),
      quantidadeBolsas,
    });
  })
);

export default router;
