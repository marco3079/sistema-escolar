import { Router } from 'express';
import type { NivelEnsino, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError } from '../../lib/erros';
import type { UsuarioToken } from '../../lib/auth';

const router = Router();

// Painel inicial (GET /api/painel/resumo) e busca do topo (GET /api/busca).
// Formatos conforme docs/plano/redesenho.md, seção "Contrato de API".

type IconePainel =
  | 'turmas'
  | 'professores'
  | 'biblioteca'
  | 'grafico'
  | 'alunos'
  | 'pos'
  | 'boletim'
  | 'financeiro';

type CorCartao = 'azul' | 'roxo' | 'verde' | 'laranja';

interface Cartao {
  chave: string;
  rotulo: string;
  valor: string;
  icone: IconePainel;
  cor: CorCartao;
  variacao: number | null;
}

interface Destaque {
  etiqueta: string;
  titulo: string;
  subtitulo: string;
  caminho: string;
}

interface PontoDesempenho {
  mes: string;
  rotulo: string;
  valor: number | null;
}

type TipoBusca = 'Aluno' | 'Professor' | 'Turma' | 'Curso' | 'Livro';

interface ItemBusca {
  tipo: TipoBusca;
  titulo: string;
  subtitulo: string;
  caminho: string;
}

interface Texto {
  contains: string;
  mode: 'insensitive';
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const TRACO = '—';

const ROTULOS_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const ROTULOS_NIVEL: Record<NivelEnsino, string> = {
  FUNDAMENTAL_1: 'Fundamental I',
  FUNDAMENTAL_2: 'Fundamental II',
  MEDIO: 'Ensino Médio',
  TECNICO: 'Técnico',
  GRADUACAO: 'Graduação',
  ESPECIALIZACAO: 'Especialização',
  MESTRADO: 'Mestrado',
  DOUTORADO: 'Doutorado',
};

// ---------- Funções auxiliares ----------

function formatarInteiro(n: number): string {
  return n.toLocaleString('pt-BR');
}

function formatarDecimal(n: number, casas: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function rotuloNivel(nivel: NivelEnsino): string {
  return ROTULOS_NIVEL[nivel];
}

function umaCasa(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatarFrequencia(n: number | null | undefined): string {
  return n === null || n === undefined ? TRACO : `${formatarDecimal(n, 1)}%`;
}

function formatarMedia(n: number | null | undefined): string {
  return n === null || n === undefined ? TRACO : formatarDecimal(n, 1);
}

function chaveMes(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Doze meses, do mais antigo ao mês atual (UTC)
function ultimosDozeMeses(): { mes: string; rotulo: string; inicio: Date }[] {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mesAtual = agora.getUTCMonth();
  const lista: { mes: string; rotulo: string; inicio: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    const inicio = new Date(Date.UTC(ano, mesAtual - i, 1));
    lista.push({ mes: chaveMes(inicio), rotulo: ROTULOS_MES[inicio.getUTCMonth()], inicio });
  }
  return lista;
}

// ---------- Painel: cartões ----------

async function cartoesAdmin(): Promise<Cartao[]> {
  const desde30 = new Date(Date.now() - 30 * MS_POR_DIA);
  const [alunos, professores, turmas, freq, novas, anteriores] = await Promise.all([
    prisma.aluno.count({ where: { matriculas: { some: { status: 'ATIVA' } } } }),
    prisma.professor.count({ where: { usuario: { ativo: true } } }),
    prisma.turma.count({ where: { periodoLetivo: { ativo: true } } }),
    prisma.inscricao.aggregate({ _avg: { frequencia: true }, where: { frequencia: { not: null } } }),
    prisma.matricula.count({ where: { status: 'ATIVA', dataMatricula: { gte: desde30 } } }),
    prisma.matricula.count({ where: { status: 'ATIVA', dataMatricula: { lt: desde30 } } }),
  ]);
  const variacao = novas > 0 && anteriores > 0 ? umaCasa((novas / anteriores) * 100) : null;
  return [
    {
      chave: 'alunos-matriculados',
      rotulo: 'Alunos matriculados',
      valor: formatarInteiro(alunos),
      icone: 'turmas',
      cor: 'azul',
      variacao,
    },
    {
      chave: 'professores-ativos',
      rotulo: 'Professores ativos',
      valor: formatarInteiro(professores),
      icone: 'professores',
      cor: 'roxo',
      variacao: null,
    },
    {
      chave: 'turmas-ativas',
      rotulo: 'Turmas ativas',
      valor: formatarInteiro(turmas),
      icone: 'biblioteca',
      cor: 'verde',
      variacao: null,
    },
    {
      chave: 'frequencia-media',
      rotulo: 'Frequência média',
      valor: formatarFrequencia(freq._avg.frequencia),
      icone: 'grafico',
      cor: 'laranja',
      variacao: null,
    },
  ];
}

async function cartoesProfessor(professorId: number | null): Promise<Cartao[]> {
  if (professorId === null) {
    return [
      { chave: 'minhas-turmas', rotulo: 'Minhas turmas', valor: '0', icone: 'turmas', cor: 'azul', variacao: null },
      { chave: 'meus-alunos', rotulo: 'Meus alunos', valor: '0', icone: 'alunos', cor: 'roxo', variacao: null },
      { chave: 'orientacoes', rotulo: 'Orientações', valor: '0', icone: 'pos', cor: 'verde', variacao: null },
      { chave: 'frequencia-media', rotulo: 'Frequência média', valor: TRACO, icone: 'grafico', cor: 'laranja', variacao: null },
    ];
  }
  const turmasDele: Prisma.TurmaWhereInput = { professorId, periodoLetivo: { ativo: true } };
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
    {
      chave: 'minhas-turmas',
      rotulo: 'Minhas turmas',
      valor: formatarInteiro(turmas),
      icone: 'turmas',
      cor: 'azul',
      variacao: null,
    },
    {
      chave: 'meus-alunos',
      rotulo: 'Meus alunos',
      valor: formatarInteiro(alunos),
      icone: 'alunos',
      cor: 'roxo',
      variacao: null,
    },
    {
      chave: 'orientacoes',
      rotulo: 'Orientações',
      valor: formatarInteiro(orientacoes),
      icone: 'pos',
      cor: 'verde',
      variacao: null,
    },
    {
      chave: 'frequencia-media',
      rotulo: 'Frequência média',
      valor: formatarFrequencia(freq._avg.frequencia),
      icone: 'grafico',
      cor: 'laranja',
      variacao: null,
    },
  ];
}

async function cartoesAluno(alunoId: number | null): Promise<Cartao[]> {
  if (alunoId === null) {
    return [
      { chave: 'disciplinas-cursando', rotulo: 'Disciplinas cursando', valor: '0', icone: 'biblioteca', cor: 'azul', variacao: null },
      { chave: 'media-geral', rotulo: 'Média geral', valor: TRACO, icone: 'boletim', cor: 'roxo', variacao: null },
      { chave: 'frequencia-media', rotulo: 'Frequência média', valor: TRACO, icone: 'grafico', cor: 'verde', variacao: null },
      { chave: 'mensalidades-abertas', rotulo: 'Mensalidades em aberto', valor: '0', icone: 'financeiro', cor: 'laranja', variacao: null },
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
    {
      chave: 'disciplinas-cursando',
      rotulo: 'Disciplinas cursando',
      valor: formatarInteiro(disciplinas),
      icone: 'biblioteca',
      cor: 'azul',
      variacao: null,
    },
    {
      chave: 'media-geral',
      rotulo: 'Média geral',
      valor: formatarMedia(notaMedia._avg.notaFinal),
      icone: 'boletim',
      cor: 'roxo',
      variacao: null,
    },
    {
      chave: 'frequencia-media',
      rotulo: 'Frequência média',
      valor: formatarFrequencia(freq._avg.frequencia),
      icone: 'grafico',
      cor: 'verde',
      variacao: null,
    },
    {
      chave: 'mensalidades-abertas',
      rotulo: 'Mensalidades em aberto',
      valor: formatarInteiro(abertas),
      icone: 'financeiro',
      cor: 'laranja',
      variacao: null,
    },
  ];
}

// ---------- Painel: desempenho (últimos 12 meses) ----------

function filtroNotas(u: UsuarioToken, inicio: Date): Prisma.NotaWhereInput | null {
  const data = { gte: inicio };
  if (u.perfil === 'ADMIN' || u.perfil === 'SECRETARIA') {
    return { avaliacao: { data } };
  }
  if (u.perfil === 'PROFESSOR') {
    if (u.professorId === null) return null;
    return { avaliacao: { data, turma: { professorId: u.professorId } } };
  }
  // Responsável não tem notas próprias (só o aluno): sem filtro, sem dados.
  if (u.perfil !== 'ALUNO' || u.alunoId === null) return null;
  return { avaliacao: { data }, inscricao: { matricula: { alunoId: u.alunoId } } };
}

async function calcularDesempenho(u: UsuarioToken): Promise<PontoDesempenho[]> {
  const meses = ultimosDozeMeses();
  const filtro = filtroNotas(u, meses[0].inicio);
  const notas = filtro
    ? await prisma.nota.findMany({
        where: filtro,
        select: {
          valor: true,
          avaliacao: { select: { data: true, notaMaxima: true, turmaId: true } },
        },
      })
    : [];

  const porMes = new Map<string, number[]>();
  for (const nota of notas) {
    const { data, notaMaxima } = nota.avaliacao;
    if (notaMaxima <= 0) continue;
    const chave = chaveMes(data);
    const lista = porMes.get(chave) ?? [];
    lista.push((nota.valor / notaMaxima) * 100);
    porMes.set(chave, lista);
  }

  return meses.map((m) => {
    const valor = media(porMes.get(m.mes) ?? []);
    return { mes: m.mes, rotulo: m.rotulo, valor: valor === null ? null : umaCasa(valor) };
  });
}

// ---------- Painel: destaque ----------

async function turmaEmDestaque(filtro: Prisma.TurmaWhereInput) {
  return prisma.turma.findFirst({
    where: { ...filtro, periodoLetivo: { ativo: true } },
    orderBy: [{ inscricoes: { _count: 'desc' } }, { id: 'asc' }],
    select: {
      id: true,
      codigo: true,
      disciplina: { select: { nome: true, curso: { select: { nome: true } } } },
    },
  });
}

async function destaqueDoPerfil(u: UsuarioToken): Promise<Destaque | null> {
  if (u.perfil === 'ADMIN' || u.perfil === 'SECRETARIA') {
    const turma = await turmaEmDestaque({});
    if (!turma) return null;
    return {
      etiqueta: 'Turma em destaque',
      titulo: turma.disciplina.nome,
      subtitulo: `${turma.disciplina.curso.nome} · ${turma.codigo}`,
      caminho: '/admin/turmas',
    };
  }
  if (u.perfil === 'PROFESSOR') {
    if (u.professorId === null) return null;
    const turma = await turmaEmDestaque({ professorId: u.professorId });
    if (!turma) return null;
    return {
      etiqueta: 'Minha turma',
      titulo: turma.disciplina.nome,
      subtitulo: `${turma.disciplina.curso.nome} · ${turma.codigo}`,
      caminho: `/professor/diario/${turma.id}`,
    };
  }
  // Responsável não tem matrícula própria: sem destaque (o início do portal é outra tela).
  if (u.perfil !== 'ALUNO' || u.alunoId === null) return null;
  const matricula = await prisma.matricula.findFirst({
    where: { alunoId: u.alunoId, status: 'ATIVA' },
    orderBy: { id: 'asc' },
    select: {
      serieAtual: true,
      curso: { select: { nome: true, nivel: true, regime: true } },
    },
  });
  if (!matricula) return null;
  const nivel = rotuloNivel(matricula.curso.nivel);
  const subtitulo =
    matricula.curso.regime === 'SERIADO'
      ? `${nivel} · ${matricula.serieAtual}ª série`
      : `${nivel} · Por créditos`;
  return {
    etiqueta: 'Meu curso',
    titulo: matricula.curso.nome,
    subtitulo,
    caminho: '/aluno/matricula',
  };
}

// ---------- Rotas ----------

router.get(
  '/painel/resumo',
  asyncHandler(async (req, res) => {
    const u = req.usuario;
    const usuario = await prisma.usuario.findUnique({
      where: { id: u.id },
      select: { nome: true },
    });
    if (!usuario) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    const primeiroNome = usuario.nome.trim().split(/\s+/)[0] ?? '';

    let cartoes: Cartao[];
    if (u.perfil === 'ADMIN' || u.perfil === 'SECRETARIA') {
      cartoes = await cartoesAdmin();
    } else if (u.perfil === 'PROFESSOR') {
      cartoes = await cartoesProfessor(u.professorId);
    } else if (u.perfil === 'ALUNO') {
      cartoes = await cartoesAluno(u.alunoId);
    } else {
      // RESPONSAVEL: estrutura neutra (zeros e traços), sem dados de aluno.
      cartoes = await cartoesAluno(null);
    }

    const [desempenho, destaque] = await Promise.all([
      calcularDesempenho(u),
      destaqueDoPerfil(u),
    ]);

    res.json({ primeiroNome, cartoes, desempenho, destaque });
  })
);

async function buscarAlunos(texto: Texto): Promise<ItemBusca[]> {
  const lista = await prisma.aluno.findMany({
    where: { OR: [{ ra: texto }, { usuario: { nome: texto } }] },
    select: { ra: true, usuario: { select: { nome: true } } },
    orderBy: { ra: 'asc' },
    take: 4,
  });
  return lista.map(
    (a): ItemBusca => ({
      tipo: 'Aluno',
      titulo: a.usuario.nome,
      subtitulo: `RA ${a.ra}`,
      caminho: '/admin/alunos',
    })
  );
}

async function buscarProfessores(texto: Texto): Promise<ItemBusca[]> {
  const lista = await prisma.professor.findMany({
    where: { usuario: { nome: texto } },
    select: { registro: true, area: true, usuario: { select: { nome: true } } },
    orderBy: { registro: 'asc' },
    take: 4,
  });
  return lista.map(
    (p): ItemBusca => ({
      tipo: 'Professor',
      titulo: p.usuario.nome,
      subtitulo: (p.area && p.area.trim()) || p.registro,
      caminho: '/admin/professores',
    })
  );
}

// Sem professorId: todas as turmas (admin). Com professorId: só as turmas dele.
async function buscarTurmas(texto: Texto, professorId?: number): Promise<ItemBusca[]> {
  const filtroTurma: Prisma.TurmaWhereInput = {
    OR: [{ codigo: texto }, { disciplina: { nome: texto } }],
  };
  if (professorId !== undefined) {
    filtroTurma.professorId = professorId;
  }
  const lista = await prisma.turma.findMany({
    where: filtroTurma,
    select: {
      id: true,
      disciplina: { select: { nome: true } },
      periodoLetivo: { select: { nome: true } },
    },
    orderBy: { id: 'asc' },
    take: 4,
  });
  return lista.map(
    (t): ItemBusca => ({
      tipo: 'Turma',
      titulo: t.disciplina.nome,
      subtitulo: t.periodoLetivo.nome,
      caminho: professorId !== undefined ? `/professor/diario/${t.id}` : '/admin/turmas',
    })
  );
}

async function buscarCursos(texto: Texto, caminho: string): Promise<ItemBusca[]> {
  const lista = await prisma.curso.findMany({
    where: { OR: [{ nome: texto }, { codigo: texto }] },
    select: { nome: true, nivel: true },
    orderBy: { nome: 'asc' },
    take: 4,
  });
  return lista.map(
    (c): ItemBusca => ({
      tipo: 'Curso',
      titulo: c.nome,
      subtitulo: rotuloNivel(c.nivel),
      caminho,
    })
  );
}

async function buscarLivros(texto: Texto, caminho: string): Promise<ItemBusca[]> {
  const lista = await prisma.livro.findMany({
    where: { OR: [{ titulo: texto }, { autor: texto }] },
    select: { titulo: true, autor: true },
    orderBy: { titulo: 'asc' },
    take: 4,
  });
  return lista.map(
    (l): ItemBusca => ({
      tipo: 'Livro',
      titulo: l.titulo,
      subtitulo: l.autor,
      caminho,
    })
  );
}

router.get(
  '/busca',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const u = req.usuario;
    const texto: Texto = { contains: q, mode: 'insensitive' };
    const itens: ItemBusca[] = [];

    if (u.perfil === 'ADMIN' || u.perfil === 'SECRETARIA') {
      itens.push(...(await buscarAlunos(texto)));
      itens.push(...(await buscarProfessores(texto)));
      itens.push(...(await buscarTurmas(texto)));
      itens.push(...(await buscarCursos(texto, '/admin/cursos')));
      itens.push(...(await buscarLivros(texto, '/admin/biblioteca')));
    } else if (u.perfil === 'PROFESSOR') {
      if (u.professorId !== null) {
        itens.push(...(await buscarTurmas(texto, u.professorId)));
      }
      itens.push(...(await buscarLivros(texto, '/professor/biblioteca')));
    } else if (u.perfil === 'ALUNO') {
      itens.push(...(await buscarCursos(texto, '/aluno/matricula')));
      itens.push(...(await buscarLivros(texto, '/aluno/biblioteca')));
    }
    // RESPONSAVEL: a busca devolve lista vazia (sem cursos, livros ou alunos).

    res.json(itens);
  })
);

export default router;
