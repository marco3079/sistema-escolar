import { Router } from 'express';
import type { Prisma, Perfil, CategoriaChamado, StatusChamado } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import type { UsuarioToken } from '../../lib/auth';

const router = Router();

// ---------- Tipos e constantes ----------

interface UsuarioResumo {
  id: number;
  nome: string;
  perfil: string;
  foto: string | null;
}

interface TurmaBase {
  id: number;
  codigo: string;
  professorId: number;
  disciplina: { nome: string };
}

interface CamposLeitura {
  status: StatusChamado;
  ultimaMensagemEm: Date;
  ultimaMensagemEquipe: boolean;
  lidoPeloAutorEm: Date | null;
  lidoPelaEquipeEm: Date | null;
}

const TAMANHO_MAXIMO_ANEXO = 200000;
const REGEX_ANEXO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]*$/;
const PREVIA_MAXIMA = 120;

const CATEGORIAS = ['TECNICO', 'SECRETARIA', 'FINANCEIRO', 'ACADEMICO'] as const;
const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA'] as const;
const STATUS = ['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_USUARIO', 'RESOLVIDO', 'FECHADO'] as const;

const SELECT_USUARIO = { id: true, nome: true, perfil: true, foto: true } satisfies Prisma.UsuarioSelect;

const SELECT_TURMA = {
  id: true,
  codigo: true,
  professorId: true,
  disciplina: { select: { nome: true } },
} satisfies Prisma.TurmaSelect;

const CAMPOS_LEITURA = {
  status: true,
  ultimaMensagemEm: true,
  ultimaMensagemEquipe: true,
  lidoPeloAutorEm: true,
  lidoPelaEquipeEm: true,
} satisfies Prisma.ChamadoSelect;

const incluirChamado = {
  mensagens: {
    orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { texto: true },
  },
  _count: { select: { mensagens: true } },
} satisfies Prisma.ChamadoInclude;

type ChamadoCarregado = Prisma.ChamadoGetPayload<{ include: typeof incluirChamado }>;

// ---------- Anexo ----------

// Só data URL de imagem (sem endereço). `null` quando vazio.
function validarAnexo(valor: unknown): string | null {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  if (typeof valor !== 'string' || valor.length > TAMANHO_MAXIMO_ANEXO || !REGEX_ANEXO.test(valor)) {
    throw new HttpError(400, 'Anexo inválido: envie uma imagem JPEG, PNG ou WebP de até 200.000 caracteres');
  }
  return valor;
}

// ---------- Usuários, turmas e equipe ----------

function perfilEfetivo(perfil: Perfil): Perfil {
  return perfil === 'TI' ? 'ADMIN' : perfil;
}

function usuarioResumo(u: { id: number; nome: string; perfil: Perfil; foto: string | null }): UsuarioResumo {
  return { id: u.id, nome: u.nome, perfil: u.perfil, foto: u.foto };
}

async function resumosDeUsuarios(ids: number[]): Promise<Map<number, UsuarioResumo>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) {
    return new Map<number, UsuarioResumo>();
  }
  const lista = await prisma.usuario.findMany({ where: { id: { in: unicos } }, select: SELECT_USUARIO });
  return new Map<number, UsuarioResumo>(
    lista.map((u) => [u.id, usuarioResumo(u)] as [number, UsuarioResumo])
  );
}

function resumoDe(mapa: Map<number, UsuarioResumo>, id: number): UsuarioResumo {
  const u = mapa.get(id);
  if (!u) {
    throw new Error(`Usuário ${id} de um chamado não encontrado`);
  }
  return u;
}

async function turmasPorId(ids: Array<number | null>): Promise<Map<number, TurmaBase>> {
  const unicos = [...new Set(ids.filter((i): i is number => i !== null))];
  if (unicos.length === 0) {
    return new Map<number, TurmaBase>();
  }
  const lista = await prisma.turma.findMany({ where: { id: { in: unicos } }, select: SELECT_TURMA });
  return new Map<number, TurmaBase>(lista.map((t) => [t.id, t] as [number, TurmaBase]));
}

// Professor da turma do chamado (só ACADEMICO tem turma de atendimento).
async function professorDaTurma(chamado: { categoria: CategoriaChamado; turmaId: number | null }): Promise<number | null> {
  if (chamado.categoria !== 'ACADEMICO' || chamado.turmaId === null) {
    return null;
  }
  const turma = await prisma.turma.findUnique({ where: { id: chamado.turmaId }, select: { professorId: true } });
  return turma?.professorId ?? null;
}

interface QuemAtende {
  id: number;
  perfil: Perfil;
  professorId: number | null;
}

// Quem atende a categoria (sem considerar autoria).
function atendeCategoria(
  quem: QuemAtende,
  categoria: CategoriaChamado,
  professorDaTurmaId: number | null
): boolean {
  const perfil = perfilEfetivo(quem.perfil);
  switch (categoria) {
    case 'TECNICO':
      return perfil === 'ADMIN';
    case 'SECRETARIA':
    case 'FINANCEIRO':
      return perfil === 'ADMIN' || perfil === 'SECRETARIA';
    case 'ACADEMICO':
      return (
        perfil === 'ADMIN' ||
        (perfil === 'PROFESSOR' && quem.professorId !== null && quem.professorId === professorDaTurmaId)
      );
    default:
      return false;
  }
}

// Verdadeiro se o usuário logado atende a categoria do chamado e não é o autor.
async function equipeDoChamado(
  usuario: UsuarioToken,
  chamado: { autorId: number; categoria: CategoriaChamado; turmaId: number | null }
): Promise<boolean> {
  if (chamado.autorId === usuario.id) {
    return false;
  }
  const professorId = await professorDaTurma(chamado);
  return atendeCategoria(usuario, chamado.categoria, professorId);
}

// `where` dos chamados que o usuário pode atender, sempre excluindo os de autoria própria.
async function filtroAtendimento(usuario: UsuarioToken): Promise<Prisma.ChamadoWhereInput> {
  const naoPropria: Prisma.ChamadoWhereInput = { autorId: { not: usuario.id } };
  switch (usuario.perfil) {
    case 'ADMIN':
      return naoPropria;
    case 'SECRETARIA':
      return { AND: [naoPropria, { categoria: { in: ['SECRETARIA', 'FINANCEIRO'] } }] };
    case 'PROFESSOR': {
      const turmas =
        usuario.professorId === null
          ? []
          : await prisma.turma.findMany({ where: { professorId: usuario.professorId }, select: { id: true } });
      return {
        AND: [naoPropria, { categoria: 'ACADEMICO' }, { turmaId: { in: turmas.map((t) => t.id) } }],
      };
    }
    default:
      // ALUNO (e qualquer outro perfil): não atende nada.
      return { id: { in: [] } };
  }
}

// ---------- Regras de leitura e DTO ----------

// Para o autor: última mensagem é da equipe e ainda não foi lida.
function naoLidoDoAutor(c: CamposLeitura): boolean {
  if (!c.ultimaMensagemEquipe) {
    return false;
  }
  return !lidoAte(c.lidoPeloAutorEm, c.ultimaMensagemEm);
}

// Para a equipe: última mensagem é do autor, ainda não lida pela equipe e chamado não fechado.
function naoLidoDaEquipe(c: CamposLeitura): boolean {
  if (c.ultimaMensagemEquipe || c.status === 'FECHADO') {
    return false;
  }
  return !lidoAte(c.lidoPelaEquipeEm, c.ultimaMensagemEm);
}

function lidoAte(lido: Date | null, ultimaMensagemEm: Date): boolean {
  return lido !== null && lido.getTime() >= ultimaMensagemEm.getTime();
}

function previaDe(texto: string | undefined): string {
  if (texto === undefined) {
    return '';
  }
  return Array.from(texto).slice(0, PREVIA_MAXIMA).join('');
}

interface ChamadoDTO {
  id: number;
  categoria: CategoriaChamado;
  assunto: string;
  prioridade: string;
  status: StatusChamado;
  turma: { id: number; codigo: string; disciplina: string } | null;
  autor: UsuarioResumo;
  responsavel: UsuarioResumo | null;
  avaliacao: number | null;
  avaliacaoComentario: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  ultimaMensagemEm: Date;
  totalMensagens: number;
  naoLido: boolean;
  souEquipe: boolean;
  previa: string;
}

// Monta os DTOs em lote (poucas consultas, independente do número de chamados).
async function paraDTOs(chamados: ChamadoCarregado[], usuario: UsuarioToken): Promise<ChamadoDTO[]> {
  const idsUsuarios = chamados.flatMap((c) => [c.autorId, c.responsavelId]).filter((i): i is number => i !== null);
  const usuarios = await resumosDeUsuarios(idsUsuarios);
  const turmas = await turmasPorId(chamados.map((c) => c.turmaId));

  return chamados.map((c) => {
    const souAutor = c.autorId === usuario.id;
    const professorId =
      c.categoria === 'ACADEMICO' && c.turmaId !== null ? (turmas.get(c.turmaId)?.professorId ?? null) : null;
    const souEquipe = !souAutor && atendeCategoria(usuario, c.categoria, professorId);
    const turma = c.turmaId !== null ? turmas.get(c.turmaId) : undefined;

    let naoLido = false;
    if (souAutor) {
      naoLido = naoLidoDoAutor(c);
    } else if (souEquipe) {
      naoLido = naoLidoDaEquipe(c);
    }

    return {
      id: c.id,
      categoria: c.categoria,
      assunto: c.assunto,
      prioridade: c.prioridade,
      status: c.status,
      turma: turma ? { id: turma.id, codigo: turma.codigo, disciplina: turma.disciplina.nome } : null,
      autor: resumoDe(usuarios, c.autorId),
      responsavel: c.responsavelId !== null ? resumoDe(usuarios, c.responsavelId) : null,
      avaliacao: c.avaliacao,
      avaliacaoComentario: c.avaliacaoComentario,
      criadoEm: c.criadoEm,
      atualizadoEm: c.atualizadoEm,
      ultimaMensagemEm: c.ultimaMensagemEm,
      totalMensagens: c._count.mensagens,
      naoLido,
      souEquipe,
      previa: previaDe(c.mensagens[0]?.texto),
    };
  });
}

async function carregarChamado(id: number): Promise<ChamadoCarregado | null> {
  return prisma.chamado.findUnique({ where: { id }, include: incluirChamado });
}

async function dtoAtual(id: number, usuario: UsuarioToken): Promise<ChamadoDTO> {
  const chamado = await carregarChamado(id);
  if (!chamado) {
    throw new HttpError(404, 'Chamado não encontrado');
  }
  const [dto] = await paraDTOs([chamado], usuario);
  return dto;
}

// ---------- Rotas fixas (antes de /chamados/:id) ----------

router.get(
  '/chamados/meus',
  asyncHandler(async (req, res) => {
    const lista = await prisma.chamado.findMany({
      where: { autorId: req.usuario.id },
      include: incluirChamado,
      orderBy: [{ ultimaMensagemEm: 'desc' }, { id: 'desc' }],
    });
    res.json(await paraDTOs(lista, req.usuario));
  })
);

router.get(
  '/chamados/novidades',
  asyncHandler(async (req, res) => {
    const usuario = req.usuario;

    const meus = await prisma.chamado.findMany({
      where: { autorId: usuario.id, ultimaMensagemEquipe: true },
      select: CAMPOS_LEITURA,
    });

    const atendimento = await prisma.chamado.findMany({
      where: {
        AND: [await filtroAtendimento(usuario), { status: { not: 'FECHADO' } }, { ultimaMensagemEquipe: false }],
      },
      select: CAMPOS_LEITURA,
    });

    res.json({
      meus: meus.filter(naoLidoDoAutor).length,
      atendimento: atendimento.filter(naoLidoDaEquipe).length,
    });
  })
);

const filtrosAtendimentoSchema = z.object({
  status: z.enum(STATUS).optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  prioridade: z.enum(PRIORIDADES).optional(),
  busca: z.string().trim().max(120).optional(),
  meus: z.enum(['true', 'false']).optional(),
});

router.get(
  '/chamados/atendimento',
  asyncHandler(async (req, res) => {
    const usuario = req.usuario;
    // Parâmetro vazio (`?status=`) é tratado como ausente.
    const bruto = Object.fromEntries(
      Object.entries(req.query).map(([chave, valor]) => [chave, valor === '' ? undefined : valor])
    );
    const filtros = validar(filtrosAtendimentoSchema, bruto);

    const condicoes: Prisma.ChamadoWhereInput[] = [await filtroAtendimento(usuario)];
    if (filtros.status) {
      condicoes.push({ status: filtros.status });
    }
    if (filtros.categoria) {
      condicoes.push({ categoria: filtros.categoria });
    }
    if (filtros.prioridade) {
      condicoes.push({ prioridade: filtros.prioridade });
    }
    if (filtros.busca) {
      condicoes.push({ assunto: { contains: filtros.busca, mode: 'insensitive' } });
    }
    if (filtros.meus === 'true') {
      condicoes.push({ responsavelId: usuario.id });
    }

    const lista = await prisma.chamado.findMany({
      where: { AND: condicoes },
      include: incluirChamado,
      orderBy: [{ ultimaMensagemEm: 'desc' }, { id: 'desc' }],
    });
    res.json(await paraDTOs(lista, usuario));
  })
);

router.get(
  '/chamados/turmas',
  asyncHandler(async (req, res) => {
    const usuario = req.usuario;
    const selecao = {
      id: true,
      codigo: true,
      disciplina: { select: { nome: true } },
      professor: { select: { usuario: { select: { nome: true } } } },
    } satisfies Prisma.TurmaSelect;

    let where: Prisma.TurmaWhereInput;
    if (usuario.perfil === 'ALUNO') {
      if (usuario.alunoId === null) {
        res.json([]);
        return;
      }
      where = { inscricoes: { some: { status: 'CURSANDO', matricula: { alunoId: usuario.alunoId } } } };
    } else {
      where = { periodoLetivo: { ativo: true } };
    }

    const turmas = await prisma.turma.findMany({ where, select: selecao, orderBy: [{ codigo: 'asc' }, { id: 'asc' }] });
    res.json(
      turmas.map((t) => ({
        id: t.id,
        codigo: t.codigo,
        disciplina: t.disciplina.nome,
        professor: t.professor.usuario.nome,
      }))
    );
  })
);

// ---------- Chamados ----------

router.get(
  '/chamados/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const usuario = req.usuario;
    const chamado = await carregarChamado(id);
    if (!chamado) {
      throw new HttpError(404, 'Chamado não encontrado');
    }
    const souAutor = chamado.autorId === usuario.id;
    const souEquipe = await equipeDoChamado(usuario, chamado);
    if (!souAutor && !souEquipe) {
      throw new HttpError(403, 'Sem permissão para ver este chamado');
    }

    const [dto] = await paraDTOs([chamado], usuario);

    const mensagens = await prisma.chamadoMensagem.findMany({
      where: { chamadoId: id },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    const autores = await resumosDeUsuarios(mensagens.map((m) => m.autorId));
    const mensagensDTO = mensagens.map((m) => ({
      id: m.id,
      texto: m.texto,
      anexo: m.anexo,
      criadoEm: m.criadoEm,
      daEquipe: m.daEquipe,
      autor: resumoDe(autores, m.autorId),
    }));

    // Marca como lido depois de montar a resposta.
    const agora = new Date();
    await prisma.chamado.update({
      where: { id },
      data: souAutor ? { lidoPeloAutorEm: agora } : { lidoPelaEquipeEm: agora },
    });

    res.json({ ...dto, mensagens: mensagensDTO });
  })
);

const criarChamadoSchema = z.object({
  categoria: z.enum(CATEGORIAS),
  assunto: z
    .string()
    .trim()
    .min(3, 'O assunto deve ter de 3 a 120 caracteres')
    .max(120, 'O assunto deve ter de 3 a 120 caracteres'),
  prioridade: z.enum(PRIORIDADES).optional(),
  turmaId: z.number().int().positive().nullable().optional(),
  texto: z.string().trim().min(1, 'Informe a mensagem').max(4000, 'A mensagem tem no máximo 4.000 caracteres'),
  anexo: z.unknown().optional(),
});

router.post(
  '/chamados',
  asyncHandler(async (req, res) => {
    const dados = validar(criarChamadoSchema, req.body);
    const anexo = validarAnexo(dados.anexo);
    const usuario = req.usuario;

    let turmaId: number | null = null;
    if (dados.categoria === 'ACADEMICO') {
      if (dados.turmaId === undefined || dados.turmaId === null) {
        throw new HttpError(400, 'Informe a turma do chamado');
      }
      const turma = await prisma.turma.findUnique({ where: { id: dados.turmaId }, select: { id: true } });
      if (!turma) {
        throw new HttpError(400, 'Turma não encontrada');
      }
      if (usuario.perfil === 'ALUNO') {
        const inscrito =
          usuario.alunoId !== null &&
          (await prisma.inscricao.findFirst({
            where: {
              turmaId: dados.turmaId,
              status: 'CURSANDO',
              matricula: { alunoId: usuario.alunoId },
            },
            select: { id: true },
          })) !== null;
        if (!inscrito) {
          throw new HttpError(403, 'Você não tem inscrição nesta turma');
        }
      }
      turmaId = dados.turmaId;
    }

    const agora = new Date();
    // Chamado e primeira mensagem criados na mesma operação (escrita aninhada é transacional).
    const criado = await prisma.chamado.create({
      data: {
        autorId: usuario.id,
        categoria: dados.categoria,
        turmaId,
        assunto: dados.assunto,
        prioridade: dados.prioridade ?? 'NORMAL',
        status: 'ABERTO',
        criadoEm: agora,
        atualizadoEm: agora,
        ultimaMensagemEm: agora,
        ultimaMensagemEquipe: false,
        lidoPeloAutorEm: agora,
        mensagens: {
          create: {
            autorId: usuario.id,
            daEquipe: false,
            texto: dados.texto,
            anexo,
            criadoEm: agora,
          },
        },
      },
      include: incluirChamado,
    });

    const [dto] = await paraDTOs([criado], usuario);
    res.status(201).json(dto);
  })
);

const mensagemSchema = z.object({
  texto: z.string().trim().min(1, 'Informe a mensagem').max(4000, 'A mensagem tem no máximo 4.000 caracteres'),
  anexo: z.unknown().optional(),
  aguardarUsuario: z.boolean().optional(),
});

router.post(
  '/chamados/:id/mensagens',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(mensagemSchema, req.body);
    const anexo = validarAnexo(dados.anexo);
    const usuario = req.usuario;

    const chamado = await carregarChamado(id);
    if (!chamado) {
      throw new HttpError(404, 'Chamado não encontrado');
    }
    const souAutor = chamado.autorId === usuario.id;
    const souEquipe = await equipeDoChamado(usuario, chamado);
    if (!souAutor && !souEquipe) {
      throw new HttpError(403, 'Sem permissão para responder este chamado');
    }
    if (chamado.status === 'FECHADO') {
      throw new HttpError(409, 'Chamado encerrado');
    }

    const agora = new Date();
    const mensagem = await prisma.$transaction(async (tx) => {
      const nova = await tx.chamadoMensagem.create({
        data: {
          chamadoId: id,
          autorId: usuario.id,
          daEquipe: souEquipe,
          texto: dados.texto,
          anexo,
          criadoEm: agora,
        },
      });

      if (souEquipe) {
        await tx.chamado.update({
          where: { id },
          data: {
            status: dados.aguardarUsuario ? 'AGUARDANDO_USUARIO' : 'EM_ATENDIMENTO',
            responsavelId: chamado.responsavelId ?? usuario.id,
            ultimaMensagemEm: agora,
            ultimaMensagemEquipe: true,
            atualizadoEm: agora,
          },
        });
      } else {
        // Autor responde: volta para ABERTO (aguardando a equipe).
        await tx.chamado.update({
          where: { id },
          data: {
            status: 'ABERTO',
            ultimaMensagemEm: agora,
            ultimaMensagemEquipe: false,
            atualizadoEm: agora,
          },
        });
      }

      return nova;
    });

    const autor = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: SELECT_USUARIO });
    if (!autor) {
      throw new HttpError(404, 'Usuário não encontrado');
    }

    res.status(201).json({
      id: mensagem.id,
      texto: mensagem.texto,
      anexo: mensagem.anexo,
      criadoEm: mensagem.criadoEm,
      daEquipe: mensagem.daEquipe,
      autor: usuarioResumo(autor),
    });
  })
);

const atualizarChamadoSchema = z.object({
  status: z.enum(['EM_ATENDIMENTO', 'AGUARDANDO_USUARIO', 'RESOLVIDO']).optional(),
  prioridade: z.enum(PRIORIDADES).optional(),
  responsavelId: z.number().int().positive().optional(),
});

router.put(
  '/chamados/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(atualizarChamadoSchema, req.body);
    const usuario = req.usuario;

    const chamado = await carregarChamado(id);
    if (!chamado) {
      throw new HttpError(404, 'Chamado não encontrado');
    }
    if (!(await equipeDoChamado(usuario, chamado))) {
      throw new HttpError(403, 'Sem permissão para alterar este chamado');
    }
    if (dados.status !== undefined && chamado.status === 'FECHADO') {
      throw new HttpError(409, 'Chamado encerrado');
    }

    if (dados.responsavelId !== undefined) {
      const candidato = await prisma.usuario.findUnique({
        where: { id: dados.responsavelId },
        select: { id: true, perfil: true, ativo: true, professor: { select: { id: true } } },
      });
      const professorId = await professorDaTurma(chamado);
      const valido =
        candidato !== null &&
        candidato.ativo &&
        candidato.id !== chamado.autorId &&
        atendeCategoria(
          { id: candidato.id, perfil: candidato.perfil, professorId: candidato.professor?.id ?? null },
          chamado.categoria,
          professorId
        );
      if (!valido) {
        throw new HttpError(400, 'O responsável precisa atender a categoria deste chamado');
      }
    }

    await prisma.chamado.update({
      where: { id },
      data: {
        atualizadoEm: new Date(),
        ...(dados.status !== undefined ? { status: dados.status } : {}),
        ...(dados.prioridade !== undefined ? { prioridade: dados.prioridade } : {}),
        ...(dados.responsavelId !== undefined ? { responsavelId: dados.responsavelId } : {}),
      },
    });

    res.json(await dtoAtual(id, usuario));
  })
);

router.post(
  '/chamados/:id/assumir',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const usuario = req.usuario;

    const chamado = await carregarChamado(id);
    if (!chamado) {
      throw new HttpError(404, 'Chamado não encontrado');
    }
    if (!(await equipeDoChamado(usuario, chamado))) {
      throw new HttpError(403, 'Sem permissão para assumir este chamado');
    }
    if (chamado.status === 'FECHADO') {
      throw new HttpError(409, 'Chamado encerrado');
    }

    await prisma.chamado.update({
      where: { id },
      data: {
        responsavelId: usuario.id,
        status: chamado.status === 'ABERTO' ? 'EM_ATENDIMENTO' : chamado.status,
        atualizadoEm: new Date(),
      },
    });

    res.json(await dtoAtual(id, usuario));
  })
);

const encerrarSchema = z.object({
  avaliacao: z.number().int().min(1).max(5).optional(),
  comentario: z.string().trim().max(500).optional(),
});

router.post(
  '/chamados/:id/encerrar',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(encerrarSchema, req.body);
    const usuario = req.usuario;

    const chamado = await carregarChamado(id);
    if (!chamado) {
      throw new HttpError(404, 'Chamado não encontrado');
    }
    if (chamado.autorId !== usuario.id) {
      throw new HttpError(403, 'Só quem abriu o chamado pode encerrá-lo');
    }
    if (chamado.status === 'FECHADO') {
      throw new HttpError(409, 'Chamado já encerrado');
    }

    await prisma.chamado.update({
      where: { id },
      data: {
        status: 'FECHADO',
        avaliacao: dados.avaliacao ?? null,
        avaliacaoComentario: dados.comentario ? dados.comentario : null,
        atualizadoEm: new Date(),
      },
    });

    res.json(await dtoAtual(id, usuario));
  })
);

router.post(
  '/chamados/:id/reabrir',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const usuario = req.usuario;

    const chamado = await carregarChamado(id);
    if (!chamado) {
      throw new HttpError(404, 'Chamado não encontrado');
    }
    if (chamado.autorId !== usuario.id) {
      throw new HttpError(403, 'Só quem abriu o chamado pode reabri-lo');
    }
    if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
      throw new HttpError(409, 'Só é possível reabrir um chamado resolvido ou encerrado');
    }

    const agora = new Date();
    await prisma.chamado.update({
      where: { id },
      data: {
        status: 'ABERTO',
        ultimaMensagemEquipe: false,
        ultimaMensagemEm: agora,
        atualizadoEm: agora,
      },
    });

    res.json(await dtoAtual(id, usuario));
  })
);

export default router;
