import { Request, Router } from 'express';
import { z } from 'zod';
import { GravidadeOcorrencia, Prisma, TipoOcorrencia } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { notificar } from '../../lib/notificacoes';
import { enderecoDoSite, enfileirarEmail } from '../../lib/email';
import { acessoAoAluno, alunosDoResponsavel, usuariosResponsaveisDoAluno } from '../../lib/responsaveis';

// Ocorrências disciplinares (sétima leva). Contrato B em docs/plano/setima-leva.md.

const router = Router();

const SEM_PERMISSAO = 'Sem permissão';
const POR_PAGINA = 30;
const MS_DIA = 24 * 60 * 60 * 1000;

type Usuario = Request['usuario'];

// ---------- Tipos do Contrato B ----------

export interface OcorrenciaDTO {
  id: number;
  aluno: { id: number; nome: string; ra: string };
  turma: { id: number; codigo: string; disciplina: string } | null;
  autor: { id: number; nome: string };
  tipo: TipoOcorrencia;
  gravidade: GravidadeOcorrencia;
  titulo: string;
  descricao: string;
  medidas: string;
  data: string; // AAAA-MM-DD
  visivelFamilia: boolean;
  cienteEm: string | null;
  cientePor: { id: number; nome: string } | null;
  criadoEm: string;
  podeEditar: boolean;
  podeDarCiencia: boolean;
}

// Campos da ocorrência como o Prisma devolve (com o aluno incluído, sem consulta por item).
interface AlunoRef {
  id: number;
  ra: string;
  usuarioId: number;
  usuario: { nome: string };
}

interface OcorrenciaRegistro {
  id: number;
  alunoId: number;
  turmaId: number | null;
  autorId: number;
  tipo: TipoOcorrencia;
  gravidade: GravidadeOcorrencia;
  titulo: string;
  descricao: string;
  medidas: string;
  data: Date;
  visivelFamilia: boolean;
  cienteEm: Date | null;
  cientePorId: number | null;
  criadoEm: Date;
  aluno: AlunoRef;
}

const INCLUIR = {
  aluno: { select: { id: true, ra: true, usuarioId: true, usuario: { select: { nome: true } } } },
} as const;

// ---------- Esquemas de entrada ----------

const TIPOS = Object.values(TipoOcorrencia) as [TipoOcorrencia, ...TipoOcorrencia[]];
const GRAVIDADES = Object.values(GravidadeOcorrencia) as [GravidadeOcorrencia, ...GravidadeOcorrencia[]];

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Data no formato AAAA-MM-DD que existe de verdade no calendário.
function ehDataValida(valor: string): boolean {
  if (!RE_DATA.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

const dataSchema = z.string().refine(ehDataValida, 'Data inválida (use AAAA-MM-DD)');

const camposOcorrencia = {
  turmaId: z.number().int().positive().nullable().optional(),
  tipo: z.enum(TIPOS),
  gravidade: z.enum(GRAVIDADES),
  titulo: z.string().trim().min(3).max(120),
  descricao: z.string().trim().min(1).max(4000),
  medidas: z.string().trim().max(2000).default(''),
  data: dataSchema,
  visivelFamilia: z.boolean(),
};

const criacaoSchema = z.object({
  alunoId: z.number().int().positive(),
  ...camposOcorrencia,
});

const edicaoSchema = z.object(camposOcorrencia);

const consultaSchema = z.object({
  alunoId: z.coerce.number().int().positive().optional(),
  tipo: z.enum(TIPOS).optional(),
  gravidade: z.enum(GRAVIDADES).optional(),
  de: dataSchema.optional(),
  ate: dataSchema.optional(),
  busca: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

// Query string: parâmetro vazio (filtro não preenchido) conta como ausente.
function semVazios(entrada: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(entrada).filter(([, valor]) => valor !== ''));
}

// ---------- Datas ----------

// A data do fato é guardada ao meio-dia UTC, para não mudar de dia com o fuso.
function diaParaBanco(dia: string): Date {
  return new Date(`${dia}T12:00:00.000Z`);
}

function isoDia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function conferirData(dia: string): void {
  if (dia > hojeISO()) {
    throw new HttpError(400, 'A data não pode estar no futuro');
  }
}

// Idade completa de 18 anos, pelo calendário UTC.
function temDezoitoAnos(nascimento: Date, agora: Date): boolean {
  let idade = agora.getUTCFullYear() - nascimento.getUTCFullYear();
  const mes = agora.getUTCMonth() - nascimento.getUTCMonth();
  if (mes < 0 || (mes === 0 && agora.getUTCDate() < nascimento.getUTCDate())) {
    idade -= 1;
  }
  return idade >= 18;
}

// ---------- Permissões ----------

// Quem pode dar ciência, e sobre quais alunos (conjunto vazio para os demais).
async function alunosComCiencia(usuario: Usuario): Promise<Set<number>> {
  if (usuario.perfil === 'RESPONSAVEL') {
    return new Set(await alunosDoResponsavel(usuario.id));
  }
  if (usuario.perfil === 'ALUNO' && usuario.alunoId !== null) {
    const aluno = await prisma.aluno.findUnique({
      where: { id: usuario.alunoId },
      select: { dataNascimento: true },
    });
    if (aluno && temDezoitoAnos(aluno.dataNascimento, new Date())) {
      return new Set([usuario.alunoId]);
    }
  }
  return new Set();
}

// Autor sem ciência registrada, ou administrador (sempre).
function podeEditarOcorrencia(registro: { autorId: number; cienteEm: Date | null }, usuario: Usuario): boolean {
  return usuario.perfil === 'ADMIN' || (registro.autorId === usuario.id && registro.cienteEm === null);
}

// Condição do UPDATE/DELETE: junto com a checagem, impede editar depois que a família deu ciência.
function condicaoDeEdicao(id: number, usuario: Usuario): Prisma.OcorrenciaWhereInput {
  if (usuario.perfil === 'ADMIN') return { id };
  return { id, autorId: usuario.id, cienteEm: null };
}

// Professor: o aluno precisa ter inscrição não trancada numa turma dele.
async function conferirAlunoDoProfessor(alunoId: number, usuario: Usuario): Promise<void> {
  if (usuario.perfil !== 'PROFESSOR') return;
  if (usuario.professorId === null) throw new HttpError(403, SEM_PERMISSAO);
  const inscrito = await prisma.inscricao.findFirst({
    where: { status: { not: 'TRANCADO' }, matricula: { alunoId }, turma: { professorId: usuario.professorId } },
    select: { id: true },
  });
  if (!inscrito) throw new HttpError(403, SEM_PERMISSAO);
}

// Turma informada: precisa existir e, para professor, ser dele.
async function conferirTurma(turmaId: number | null | undefined, usuario: Usuario): Promise<void> {
  if (turmaId === null || turmaId === undefined) return;
  const turma = await prisma.turma.findUnique({ where: { id: turmaId }, select: { professorId: true } });
  if (!turma) throw new HttpError(400, 'Turma não encontrada');
  if (usuario.perfil === 'PROFESSOR' && turma.professorId !== usuario.professorId) {
    throw new HttpError(403, SEM_PERMISSAO);
  }
}

async function carregarOcorrencia(id: number): Promise<OcorrenciaRegistro> {
  const registro = await prisma.ocorrencia.findUnique({ where: { id }, include: INCLUIR });
  if (!registro) throw new HttpError(404, 'Ocorrência não encontrada');
  return registro;
}

// ---------- Conversão para o DTO ----------

// Nomes de autor e de quem deu ciência, e a disciplina da turma: buscados em lote (uma consulta por tipo).
async function montarOcorrencias(
  registros: OcorrenciaRegistro[],
  usuario: Usuario,
  podemDarCiencia: Set<number>
): Promise<OcorrenciaDTO[]> {
  if (registros.length === 0) return [];

  const idsUsuarios = new Set<number>();
  const idsTurmas = new Set<number>();
  for (const r of registros) {
    idsUsuarios.add(r.autorId);
    if (r.cientePorId !== null) idsUsuarios.add(r.cientePorId);
    if (r.turmaId !== null) idsTurmas.add(r.turmaId);
  }

  const [usuarios, turmas] = await Promise.all([
    prisma.usuario.findMany({ where: { id: { in: [...idsUsuarios] } }, select: { id: true, nome: true } }),
    prisma.turma.findMany({
      where: { id: { in: [...idsTurmas] } },
      select: { id: true, codigo: true, disciplina: { select: { nome: true } } },
    }),
  ]);
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  const turmasPorId = new Map(turmas.map((t) => [t.id, t]));
  const nomeDe = (id: number): string => nomes.get(id) ?? 'Usuário removido';

  return registros.map((r): OcorrenciaDTO => {
    const turma = r.turmaId !== null ? turmasPorId.get(r.turmaId) : undefined;
    return {
      id: r.id,
      aluno: { id: r.aluno.id, nome: r.aluno.usuario.nome, ra: r.aluno.ra },
      turma: turma ? { id: turma.id, codigo: turma.codigo, disciplina: turma.disciplina.nome } : null,
      autor: { id: r.autorId, nome: nomeDe(r.autorId) },
      tipo: r.tipo,
      gravidade: r.gravidade,
      titulo: r.titulo,
      descricao: r.descricao,
      medidas: r.medidas,
      data: isoDia(r.data),
      visivelFamilia: r.visivelFamilia,
      cienteEm: r.cienteEm ? r.cienteEm.toISOString() : null,
      cientePor: r.cientePorId !== null ? { id: r.cientePorId, nome: nomeDe(r.cientePorId) } : null,
      criadoEm: r.criadoEm.toISOString(),
      podeEditar: podeEditarOcorrencia(r, usuario),
      podeDarCiencia: r.visivelFamilia && r.cienteEm === null && podemDarCiencia.has(r.alunoId),
    };
  });
}

// ---------- Avisos (não aguardados: a resposta não espera) ----------

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

// Avisa o aluno e os responsáveis; e-mail só para os responsáveis, sem a descrição nem o nome completo.
function avisarFamilia(registro: OcorrenciaRegistro): void {
  void (async () => {
    try {
      const idsResponsaveis = await usuariosResponsaveisDoAluno(registro.alunoId);
      notificar([registro.aluno.usuarioId, ...idsResponsaveis], {
        tipo: 'OCORRENCIA',
        titulo:
          registro.tipo === 'ELOGIO'
            ? `Elogio registrado: ${registro.titulo}`
            : `Nova ocorrência: ${registro.titulo}`,
        link: '/ocorrencias',
        chave: `ocorrencia-${registro.id}`,
      });
      if (idsResponsaveis.length === 0) return;

      const responsaveis = await prisma.usuario.findMany({
        where: { id: { in: idsResponsaveis } },
        select: { email: true },
      });
      const site = await enderecoDoSite();
      const nomeAluno = primeiroNome(registro.aluno.usuario.nome);
      for (const responsavel of responsaveis) {
        enfileirarEmail({
          para: responsavel.email,
          assunto: 'Novo registro no portal dos responsáveis',
          titulo: 'Há um registro novo no portal',
          paragrafos: [
            `Há um registro novo sobre ${nomeAluno} no portal dos responsáveis.`,
            'Entre no portal para ver os detalhes.',
          ],
          tipo: 'SECRETARIA',
          ...(site ? { botao: { rotulo: 'Abrir o portal', endereco: `${site}/responsavel/ocorrencias` } } : {}),
        });
      }
    } catch (erro) {
      console.error('Falha ao avisar a família sobre a ocorrência:', erro instanceof Error ? erro.message : erro);
    }
  })();
}

// ---------- Rotas ----------

// Lista da gestão (e do professor, só as que ele registrou).
router.get(
  '/ocorrencias',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const consulta = validar(consultaSchema, semVazios(req.query));
    const usuario = req.usuario;

    const where: Prisma.OcorrenciaWhereInput = {};
    if (usuario.perfil === 'PROFESSOR') where.autorId = usuario.id;
    if (consulta.alunoId !== undefined) where.alunoId = consulta.alunoId;
    if (consulta.tipo !== undefined) where.tipo = consulta.tipo;
    if (consulta.gravidade !== undefined) where.gravidade = consulta.gravidade;
    if (consulta.de !== undefined || consulta.ate !== undefined) {
      where.data = {
        ...(consulta.de !== undefined ? { gte: new Date(`${consulta.de}T00:00:00.000Z`) } : {}),
        ...(consulta.ate !== undefined ? { lte: new Date(`${consulta.ate}T23:59:59.999Z`) } : {}),
      };
    }
    if (consulta.busca) {
      where.OR = [
        { titulo: { contains: consulta.busca, mode: 'insensitive' } },
        { aluno: { usuario: { nome: { contains: consulta.busca, mode: 'insensitive' } } } },
      ];
    }

    const [total, registros] = await Promise.all([
      prisma.ocorrencia.count({ where }),
      prisma.ocorrencia.findMany({
        where,
        orderBy: [{ data: 'desc' }, { id: 'desc' }],
        skip: (consulta.pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        include: INCLUIR,
      }),
    ]);

    res.json({
      itens: await montarOcorrencias(registros, usuario, await alunosComCiencia(usuario)),
      total,
      pagina: consulta.pagina,
      porPagina: POR_PAGINA,
    });
  })
);

// Resumo da secretaria. Declarado antes de /ocorrencias/:id.
router.get(
  '/ocorrencias/resumo',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (_req, res) => {
    const desde = new Date(Date.now() - 30 * MS_DIA);
    const [ultimos30Dias, semCiencia, linhasPorTipo, linhasPorGravidade] = await Promise.all([
      prisma.ocorrencia.count({ where: { criadoEm: { gte: desde } } }),
      prisma.ocorrencia.count({ where: { visivelFamilia: true, cienteEm: null } }),
      prisma.ocorrencia.groupBy({ by: ['tipo'], _count: { _all: true } }),
      prisma.ocorrencia.groupBy({ by: ['gravidade'], _count: { _all: true } }),
    ]);

    const porTipo = {} as Record<TipoOcorrencia, number>;
    for (const tipo of TIPOS) porTipo[tipo] = 0;
    for (const linha of linhasPorTipo) porTipo[linha.tipo] = linha._count._all;

    const porGravidade = {} as Record<GravidadeOcorrencia, number>;
    for (const gravidade of GRAVIDADES) porGravidade[gravidade] = 0;
    for (const linha of linhasPorGravidade) porGravidade[linha.gravidade] = linha._count._all;

    res.json({ ultimos30Dias, semCiencia, porTipo, porGravidade });
  })
);

// Ocorrências de um aluno: gestão vê todas; professor as dele; família só as visíveis.
router.get(
  '/alunos/:alunoId/ocorrencias',
  asyncHandler(async (req, res) => {
    const alunoId = idParam(req, 'alunoId');
    const usuario = req.usuario;

    let where: Prisma.OcorrenciaWhereInput = { alunoId };
    if (usuario.perfil === 'PROFESSOR') {
      await conferirAlunoDoProfessor(alunoId, usuario);
      where = { alunoId, autorId: usuario.id };
    } else if (usuario.perfil !== 'ADMIN' && usuario.perfil !== 'SECRETARIA') {
      // Aluno próprio ou responsável com vínculo (403 para os demais).
      await acessoAoAluno(req, alunoId);
      where = { alunoId, visivelFamilia: true };
    }

    const registros = await prisma.ocorrencia.findMany({
      where,
      orderBy: [{ data: 'desc' }, { id: 'desc' }],
      include: INCLUIR,
    });
    res.json(await montarOcorrencias(registros, usuario, await alunosComCiencia(usuario)));
  })
);

router.post(
  '/ocorrencias',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const usuario = req.usuario;
    const dados = validar(criacaoSchema, req.body);

    const aluno = await prisma.aluno.findUnique({ where: { id: dados.alunoId }, select: { id: true } });
    if (!aluno) throw new HttpError(404, 'Aluno não encontrado');
    await conferirAlunoDoProfessor(dados.alunoId, usuario);
    conferirData(dados.data);
    await conferirTurma(dados.turmaId, usuario);

    const criada = await prisma.ocorrencia.create({
      data: {
        alunoId: dados.alunoId,
        turmaId: dados.turmaId ?? null,
        autorId: usuario.id,
        tipo: dados.tipo,
        gravidade: dados.gravidade,
        titulo: dados.titulo,
        descricao: dados.descricao,
        medidas: dados.medidas,
        data: diaParaBanco(dados.data),
        visivelFamilia: dados.visivelFamilia,
      },
      include: INCLUIR,
    });
    if (criada.visivelFamilia) {
      avisarFamilia(criada);
    }

    const [dto] = await montarOcorrencias([criada], usuario, await alunosComCiencia(usuario));
    res.status(201).json(dto);
  })
);

router.put(
  '/ocorrencias/:id',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const usuario = req.usuario;
    const atual = await carregarOcorrencia(id);
    if (!podeEditarOcorrencia(atual, usuario)) throw new HttpError(403, SEM_PERMISSAO);

    const dados = validar(edicaoSchema, req.body);
    conferirData(dados.data);
    await conferirTurma(dados.turmaId, usuario);

    const alterada = await prisma.ocorrencia.updateMany({
      where: condicaoDeEdicao(id, usuario),
      data: {
        turmaId: dados.turmaId ?? null,
        tipo: dados.tipo,
        gravidade: dados.gravidade,
        titulo: dados.titulo,
        descricao: dados.descricao,
        medidas: dados.medidas,
        data: diaParaBanco(dados.data),
        visivelFamilia: dados.visivelFamilia,
      },
    });
    if (alterada.count === 0) {
      throw new HttpError(409, 'Esta ocorrência não pode mais ser alterada (a família já deu ciência)');
    }

    const depois = await carregarOcorrencia(id);
    if (depois.visivelFamilia && !atual.visivelFamilia) {
      avisarFamilia(depois);
    }

    const [dto] = await montarOcorrencias([depois], usuario, await alunosComCiencia(usuario));
    res.json(dto);
  })
);

router.delete(
  '/ocorrencias/:id',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const usuario = req.usuario;
    const atual = await carregarOcorrencia(id);
    if (!podeEditarOcorrencia(atual, usuario)) throw new HttpError(403, SEM_PERMISSAO);

    const removida = await prisma.ocorrencia.deleteMany({ where: condicaoDeEdicao(id, usuario) });
    if (removida.count === 0) {
      throw new HttpError(409, 'Esta ocorrência não pode mais ser excluída (a família já deu ciência)');
    }
    res.status(204).end();
  })
);

// Ciência: responsável com vínculo, ou o próprio aluno com 18 anos ou mais.
router.post(
  '/ocorrencias/:id/ciencia',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const usuario = req.usuario;
    const registro = await carregarOcorrencia(id);

    const podemDarCiencia = await alunosComCiencia(usuario);
    if (!podemDarCiencia.has(registro.alunoId)) throw new HttpError(403, SEM_PERMISSAO);
    // Fora do portal da família: 404, como se não existisse.
    if (!registro.visivelFamilia) throw new HttpError(404, 'Ocorrência não encontrada');

    if (registro.cienteEm === null) {
      const registrada = await prisma.ocorrencia.updateMany({
        where: { id, cienteEm: null },
        data: { cienteEm: new Date(), cientePorId: usuario.id },
      });
      if (registrada.count > 0) {
        notificar([registro.autorId], {
          tipo: 'OCORRENCIA',
          titulo: `Ciência registrada: ${registro.titulo}`,
          link: '/ocorrencias',
        });
      }
    }

    const atual = await carregarOcorrencia(id);
    const [dto] = await montarOcorrencias([atual], usuario, podemDarCiencia);
    res.json(dto);
  })
);

export default router;
