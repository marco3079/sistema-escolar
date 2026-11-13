import { Router } from 'express';
import { z } from 'zod';
import type { Perfil } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir, type UsuarioToken } from '../../lib/auth';
import { alunosDoResponsavel } from '../../lib/responsaveis';
import { notificar } from '../../lib/notificacoes';
import { validarImagem } from './imagem';
import {
  calcularAutomaticas,
  calcularMedalhas,
  calcularNivel,
  type CorMedalha,
  type MedalhaDTO,
} from './medalhas';

const router = Router();

// Perfil completo, perfil público, foto e medalhas (formatos em docs/plano/terceira-leva.md, "Perfil e medalhas").

const ICONES_MANUAIS = ['medalha', 'estrela', 'boletim', 'biblioteca', 'grafico', 'pos', 'alunos'] as const;
const CORES_MANUAIS = ['azul', 'roxo', 'verde', 'laranja'] as const;

// ---------- Funções auxiliares ----------

const TRACO = '—';

function formatarInteiro(n: number): string {
  return n.toLocaleString('pt-BR');
}

function formatarDecimal(n: number, casas: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatarFrequencia(n: number | null | undefined): string {
  return n === null || n === undefined ? TRACO : `${formatarDecimal(n, 1)}%`;
}

function formatarMedia(n: number | null | undefined): string {
  return n === null || n === undefined ? TRACO : formatarDecimal(n, 1);
}

interface CartaoResumo {
  rotulo: string;
  valor: string;
  icone: string;
  cor: string;
}

// Os mesmos quatro indicadores de GET /painel/resumo, por perfil (lógica copiada, sem variação).
async function resumoAdmin(): Promise<CartaoResumo[]> {
  const [alunos, professores, turmas, freq] = await Promise.all([
    prisma.aluno.count({ where: { matriculas: { some: { status: 'ATIVA' } } } }),
    prisma.professor.count({ where: { usuario: { ativo: true } } }),
    prisma.turma.count({ where: { periodoLetivo: { ativo: true } } }),
    prisma.inscricao.aggregate({ _avg: { frequencia: true }, where: { frequencia: { not: null } } }),
  ]);
  return [
    { rotulo: 'Alunos matriculados', valor: formatarInteiro(alunos), icone: 'turmas', cor: 'azul' },
    { rotulo: 'Professores ativos', valor: formatarInteiro(professores), icone: 'professores', cor: 'roxo' },
    { rotulo: 'Turmas ativas', valor: formatarInteiro(turmas), icone: 'biblioteca', cor: 'verde' },
    { rotulo: 'Frequência média', valor: formatarFrequencia(freq._avg.frequencia), icone: 'grafico', cor: 'laranja' },
  ];
}

async function resumoProfessor(professorId: number | null): Promise<CartaoResumo[]> {
  if (professorId === null) {
    return [
      { rotulo: 'Minhas turmas', valor: '0', icone: 'turmas', cor: 'azul' },
      { rotulo: 'Meus alunos', valor: '0', icone: 'alunos', cor: 'roxo' },
      { rotulo: 'Orientações', valor: '0', icone: 'pos', cor: 'verde' },
      { rotulo: 'Frequência média', valor: TRACO, icone: 'grafico', cor: 'laranja' },
    ];
  }
  const turmasDele = { professorId, periodoLetivo: { ativo: true } };
  const [turmas, alunos, orientacoes, freq] = await Promise.all([
    prisma.turma.count({ where: turmasDele }),
    prisma.inscricao.count({ where: { status: 'CURSANDO', turma: turmasDele } }),
    prisma.projetoPesquisa.count({ where: { orientadorId: professorId } }),
    prisma.inscricao.aggregate({
      _avg: { frequencia: true },
      where: { frequencia: { not: null }, turma: turmasDele },
    }),
  ]);
  return [
    { rotulo: 'Minhas turmas', valor: formatarInteiro(turmas), icone: 'turmas', cor: 'azul' },
    { rotulo: 'Meus alunos', valor: formatarInteiro(alunos), icone: 'alunos', cor: 'roxo' },
    { rotulo: 'Orientações', valor: formatarInteiro(orientacoes), icone: 'pos', cor: 'verde' },
    { rotulo: 'Frequência média', valor: formatarFrequencia(freq._avg.frequencia), icone: 'grafico', cor: 'laranja' },
  ];
}

async function resumoAluno(alunoId: number | null): Promise<CartaoResumo[]> {
  if (alunoId === null) {
    return [
      { rotulo: 'Disciplinas cursando', valor: '0', icone: 'biblioteca', cor: 'azul' },
      { rotulo: 'Média geral', valor: TRACO, icone: 'boletim', cor: 'roxo' },
      { rotulo: 'Frequência média', valor: TRACO, icone: 'grafico', cor: 'verde' },
      { rotulo: 'Mensalidades em aberto', valor: '0', icone: 'financeiro', cor: 'laranja' },
    ];
  }
  const [disciplinas, notaMedia, freq, abertas] = await Promise.all([
    prisma.inscricao.count({ where: { status: 'CURSANDO', matricula: { alunoId } } }),
    prisma.inscricao.aggregate({
      _avg: { notaFinal: true },
      where: { notaFinal: { not: null }, matricula: { alunoId } },
    }),
    prisma.inscricao.aggregate({
      _avg: { frequencia: true },
      where: { frequencia: { not: null }, matricula: { alunoId } },
    }),
    prisma.mensalidade.count({
      where: { status: { in: ['ABERTA', 'ATRASADA'] }, matricula: { alunoId } },
    }),
  ]);
  return [
    { rotulo: 'Disciplinas cursando', valor: formatarInteiro(disciplinas), icone: 'biblioteca', cor: 'azul' },
    { rotulo: 'Média geral', valor: formatarMedia(notaMedia._avg.notaFinal), icone: 'boletim', cor: 'roxo' },
    { rotulo: 'Frequência média', valor: formatarFrequencia(freq._avg.frequencia), icone: 'grafico', cor: 'verde' },
    { rotulo: 'Mensalidades em aberto', valor: formatarInteiro(abertas), icone: 'financeiro', cor: 'laranja' },
  ];
}

// Perfil verdadeiro vindo do banco. TI usa o mesmo painel de ADMIN.
async function resumoDoPerfil(usuario: { perfil: Perfil; alunoId: number | null; professorId: number | null }) {
  if (usuario.perfil === 'ADMIN' || usuario.perfil === 'TI' || usuario.perfil === 'SECRETARIA') {
    return resumoAdmin();
  }
  if (usuario.perfil === 'PROFESSOR') {
    return resumoProfessor(usuario.professorId);
  }
  return resumoAluno(usuario.alunoId);
}

// Conquistadas primeiro (manuais mais recentes antes); depois as ainda não conquistadas.
function ordenarMedalhas(medalhas: MedalhaDTO[]): MedalhaDTO[] {
  return [...medalhas].sort((a, b) => {
    if (a.conquistada !== b.conquistada) return a.conquistada ? -1 : 1;
    if (a.conquistadaEm && b.conquistadaEm) return b.conquistadaEm.localeCompare(a.conquistadaEm);
    return 0;
  });
}

function somarPontos(medalhas: MedalhaDTO[]): number {
  return medalhas.reduce((soma, m) => (m.conquistada ? soma + m.pontos : soma), 0);
}

async function carregarUsuario(id: number) {
  return prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      email: true,
      perfil: true,
      ativo: true,
      telefone: true,
      foto: true,
      criadoEm: true,
      aluno: {
        select: {
          id: true,
          ra: true,
          matriculas: {
            where: { status: 'ATIVA' },
            orderBy: { id: 'asc' },
            take: 1,
            select: { curso: { select: { nome: true } } },
          },
        },
      },
      professor: { select: { id: true, registro: true, titulacao: true, area: true } },
    },
  });
}

type UsuarioCarregado = NonNullable<Awaited<ReturnType<typeof carregarUsuario>>>;

function cursoDo(usuario: UsuarioCarregado): string | null {
  return usuario.aluno?.matriculas[0]?.curso.nome ?? null;
}

function mapaUsuarioMedalhas(usuario: UsuarioCarregado) {
  return {
    id: usuario.id,
    perfil: usuario.perfil,
    alunoId: usuario.aluno?.id ?? null,
    professorId: usuario.professor?.id ?? null,
  };
}

// ---------- Perfil completo (usuário logado) ----------

router.get(
  '/perfil/completo',
  asyncHandler(async (req, res) => {
    const usuario = await carregarUsuario(req.usuario.id);
    if (!usuario) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    const [medalhasBrutas, resumo, atividades] = await Promise.all([
      calcularMedalhas(mapaUsuarioMedalhas(usuario)),
      resumoDoPerfil({
        perfil: usuario.perfil,
        alunoId: usuario.aluno?.id ?? null,
        professorId: usuario.professor?.id ?? null,
      }),
      prisma.logAtividade.findMany({
        where: { usuarioId: usuario.id, tipo: { not: 'CONSULTA' } },
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        take: 10,
        select: { id: true, criadoEm: true, tipo: true, descricao: true, modulo: true },
      }),
    ]);
    const medalhas = ordenarMedalhas(medalhasBrutas);
    res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        telefone: usuario.telefone,
        foto: usuario.foto,
        criadoEm: usuario.criadoEm.toISOString(),
        ra: usuario.aluno?.ra ?? null,
        registro: usuario.professor?.registro ?? null,
        titulacao: usuario.professor?.titulacao ?? null,
        area: usuario.professor?.area ?? null,
        curso: cursoDo(usuario),
      },
      nivel: calcularNivel(somarPontos(medalhas)),
      resumo,
      medalhas,
      atividadeRecente: atividades.map((a) => ({
        id: a.id,
        criadoEm: a.criadoEm.toISOString(),
        tipo: a.tipo,
        descricao: a.descricao,
        modulo: a.modulo,
      })),
    });
  })
);

// ---------- Perfil público (para o fórum e outras telas) ----------

// Quem pode ver o perfil público de `alvo`. Responsável: só vê a equipe, professores, alunos ligados a ele e a si mesmo.
// Perfil de responsável: só a equipe, ele mesmo e professores que dão aula a alunos dele. Demais casos: sim.
async function podeVerPerfilPublico(quem: UsuarioToken, alvo: UsuarioCarregado): Promise<boolean> {
  if (alvo.perfil === 'RESPONSAVEL') {
    if (quem.id === alvo.id) return true;
    if (quem.perfil === 'ADMIN' || quem.perfil === 'SECRETARIA') return true;
    if (quem.perfil !== 'PROFESSOR' || quem.professorId === null) return false;
    const alunoIds = await alunosDoResponsavel(alvo.id);
    if (alunoIds.length === 0) return false;
    const turmas = await prisma.inscricao.count({
      where: {
        status: { not: 'TRANCADO' },
        matricula: { alunoId: { in: alunoIds } },
        turma: { professorId: quem.professorId },
      },
    });
    return turmas > 0;
  }
  if (quem.perfil !== 'RESPONSAVEL' || quem.id === alvo.id) return true;
  if (alvo.perfil === 'ALUNO') {
    const alunoId = alvo.aluno?.id;
    return alunoId !== undefined && (await alunosDoResponsavel(quem.id)).includes(alunoId);
  }
  return alvo.perfil === 'ADMIN' || alvo.perfil === 'TI' || alvo.perfil === 'SECRETARIA' || alvo.perfil === 'PROFESSOR';
}

router.get(
  '/usuarios/:id/perfil-publico',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const usuario = await carregarUsuario(id);
    if (!usuario || !usuario.ativo || !(await podeVerPerfilPublico(req.usuario, usuario))) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    const medalhas = ordenarMedalhas(
      (await calcularMedalhas(mapaUsuarioMedalhas(usuario))).filter((m) => m.conquistada)
    );
    res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        perfil: usuario.perfil,
        foto: usuario.foto,
        curso: cursoDo(usuario),
        titulacao: usuario.professor?.titulacao ?? null,
      },
      nivel: calcularNivel(somarPontos(medalhas)),
      medalhas,
    });
  })
);

// ---------- Foto ----------

const fotoSchema = z.object({ foto: z.string().nullable() });

router.put(
  '/perfil/foto',
  asyncHandler(async (req, res) => {
    const dados = validar(fotoSchema, req.body);
    const foto = validarImagem(dados.foto, { aceitaEndereco: true });
    await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { foto },
      select: { id: true },
    });
    res.json({ foto });
  })
);

// ---------- Catálogo ----------

router.get(
  '/medalhas/catalogo',
  asyncHandler(async (req, res) => {
    const usuario = await carregarUsuario(req.usuario.id);
    if (!usuario) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    const automaticas = await calcularAutomaticas(mapaUsuarioMedalhas(usuario));
    res.json(
      automaticas.map((m) => ({
        codigo: m.codigo,
        titulo: m.titulo,
        descricao: m.descricao,
        icone: m.icone,
        cor: m.cor,
        pontos: m.pontos,
        conquistada: m.conquistada,
        progresso: m.progresso,
      }))
    );
  })
);

// ---------- Medalhas concedidas à mão ----------

const criarMedalhaSchema = z.object({
  usuarioId: z.number().int().positive(),
  titulo: z.string().trim().min(3).max(60),
  descricao: z.string().trim().max(200).nullable().optional(),
  icone: z.enum(ICONES_MANUAIS).optional(),
  cor: z.enum(CORES_MANUAIS).optional(),
  pontos: z.number().int().min(5).max(50).optional(),
});

router.post(
  '/medalhas',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const dados = validar(criarMedalhaSchema, req.body);
    const destino = await prisma.usuario.findUnique({
      where: { id: dados.usuarioId },
      select: { id: true, perfil: true, ativo: true },
    });
    if (!destino || !destino.ativo) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    if (destino.perfil !== 'ALUNO' && destino.perfil !== 'PROFESSOR') {
      throw new HttpError(400, 'A medalha só pode ser concedida a aluno ou professor');
    }
    const u = req.usuario;
    if (u.perfil === 'PROFESSOR') {
      // Professor só premia aluno com inscrição (qualquer status) em turma dele.
      if (u.professorId === null || destino.perfil !== 'ALUNO') {
        throw new HttpError(403, 'Sem permissão para conceder medalha a este usuário');
      }
      const vinculos = await prisma.inscricao.count({
        where: {
          matricula: { aluno: { usuarioId: destino.id } },
          turma: { professorId: u.professorId },
        },
      });
      if (vinculos === 0) {
        throw new HttpError(403, 'Sem permissão para conceder medalha a este usuário');
      }
    }

    const [concedente, criada] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: u.id }, select: { nome: true } }),
      prisma.medalhaConcedida.create({
        data: {
          usuarioId: destino.id,
          concedidaPorId: u.id,
          titulo: dados.titulo,
          descricao: dados.descricao ? dados.descricao : null,
          icone: dados.icone ?? 'medalha',
          cor: dados.cor ?? 'azul',
          pontos: dados.pontos ?? 20,
        },
      }),
    ]);

    notificar([destino.id], {
      tipo: 'MEDALHA',
      titulo: `Você recebeu a medalha ${criada.titulo}`,
      link: '/perfil',
    });

    const dto: MedalhaDTO = {
      codigo: 'manual-' + criada.id,
      titulo: criada.titulo,
      descricao: criada.descricao ?? '',
      icone: criada.icone,
      cor: criada.cor as CorMedalha,
      pontos: criada.pontos,
      conquistada: true,
      conquistadaEm: criada.criadoEm.toISOString(),
      manual: true,
      id: criada.id,
      concedidaPor: concedente?.nome ?? null,
      progresso: null,
    };
    res.status(201).json(dto);
  })
);

router.delete(
  '/medalhas/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const medalha = await prisma.medalhaConcedida.findUnique({
      where: { id },
      select: { id: true, concedidaPorId: true },
    });
    if (!medalha) {
      throw new HttpError(404, 'Medalha não encontrada');
    }
    if (req.usuario.perfil !== 'ADMIN' && medalha.concedidaPorId !== req.usuario.id) {
      throw new HttpError(403, 'Sem permissão para remover esta medalha');
    }
    await prisma.medalhaConcedida.delete({ where: { id } });
    res.status(204).end();
  })
);

export default router;
