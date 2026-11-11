import type { Perfil } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// Catálogo e cálculo das medalhas (contrato em docs/plano/terceira-leva.md, "Perfil e medalhas").
// As automáticas são calculadas na hora; as manuais vêm de MedalhaConcedida.

export type CorMedalha = 'azul' | 'roxo' | 'verde' | 'laranja';

export interface Progresso {
  atual: number;
  meta: number;
}

export interface MedalhaDTO {
  codigo: string;
  titulo: string;
  descricao: string;
  icone: string;
  cor: CorMedalha;
  pontos: number;
  conquistada: boolean;
  conquistadaEm: string | null;
  manual: boolean;
  id: number | null;
  concedidaPor: string | null;
  progresso: Progresso | null;
}

export interface NivelDTO {
  pontos: number;
  nivel: number;
  titulo: string;
  pontosDoNivel: number;
  pontosProximoNivel: number | null;
}

type PerfilAutomatico = 'ALUNO' | 'PROFESSOR';

interface DefinicaoMedalha {
  codigo: string;
  titulo: string;
  descricao: string;
  icone: string;
  cor: CorMedalha;
  pontos: number;
  perfis: PerfilAutomatico[];
}

interface Resultado {
  conquistada: boolean;
  progresso: Progresso | null;
}

export interface UsuarioMedalhas {
  id: number;
  perfil: Perfil;
  alunoId: number | null;
  professorId: number | null;
}

// ---------- Catálogo ----------

// Ordem: medalhas do aluno, depois as do professor (leitor e voz-ativa valem para os dois).
export const CATALOGO_AUTOMATICO: readonly DefinicaoMedalha[] = [
  // Aluno
  {
    codigo: 'primeiros-passos',
    titulo: 'Primeiros passos',
    descricao: 'Ter uma matrícula.',
    icone: 'matriculas',
    cor: 'azul',
    pontos: 10,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'presenca-total',
    titulo: 'Presença total',
    descricao: 'Ter 100% de frequência em uma disciplina encerrada ou em curso.',
    icone: 'calendario',
    cor: 'verde',
    pontos: 20,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'assiduo',
    titulo: 'Assíduo',
    descricao: 'Ter frequência média de 90% ou mais.',
    icone: 'grafico',
    cor: 'verde',
    pontos: 30,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'nota-dez',
    titulo: 'Nota máxima',
    descricao: 'Tirar a nota máxima em uma avaliação.',
    icone: 'boletim',
    cor: 'laranja',
    pontos: 20,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'excelencia',
    titulo: 'Excelência',
    descricao: 'Ter média geral de 9,0 ou mais.',
    icone: 'medalha',
    cor: 'roxo',
    pontos: 40,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'aprovado',
    titulo: 'Aprovado',
    descricao: 'Ser aprovado na primeira disciplina.',
    icone: 'documento',
    cor: 'azul',
    pontos: 10,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'maratonista',
    titulo: 'Maratonista',
    descricao: 'Ser aprovado em 5 disciplinas.',
    icone: 'historico',
    cor: 'azul',
    pontos: 30,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'leitor',
    titulo: 'Leitor',
    descricao: 'Pegar um livro emprestado na biblioteca.',
    icone: 'biblioteca',
    cor: 'laranja',
    pontos: 10,
    perfis: ['ALUNO', 'PROFESSOR'],
  },
  {
    codigo: 'rato-de-biblioteca',
    titulo: 'Rato de biblioteca',
    descricao: 'Fazer 5 empréstimos na biblioteca.',
    icone: 'biblioteca',
    cor: 'laranja',
    pontos: 30,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'em-dia',
    titulo: 'Em dia',
    descricao: 'Ter pelo menos 3 mensalidades pagas e nenhuma em atraso.',
    icone: 'financeiro',
    cor: 'verde',
    pontos: 20,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'pesquisador',
    titulo: 'Pesquisador',
    descricao: 'Ter um projeto de pesquisa.',
    icone: 'pos',
    cor: 'roxo',
    pontos: 20,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'mestre-da-banca',
    titulo: 'Aprovado pela banca',
    descricao: 'Ter projeto qualificado ou aprovado.',
    icone: 'pos',
    cor: 'roxo',
    pontos: 40,
    perfis: ['ALUNO'],
  },
  {
    codigo: 'voz-ativa',
    titulo: 'Voz ativa',
    descricao: 'Fazer 3 publicações ou comentários no fórum.',
    icone: 'forum',
    cor: 'azul',
    pontos: 10,
    perfis: ['ALUNO', 'PROFESSOR'],
  },
  // Professor
  {
    codigo: 'mestre',
    titulo: 'Na ativa',
    descricao: 'Lecionar pelo menos uma turma em período letivo ativo.',
    icone: 'turmas',
    cor: 'azul',
    pontos: 10,
    perfis: ['PROFESSOR'],
  },
  {
    codigo: 'diario-em-dia',
    titulo: 'Diário em dia',
    descricao: 'Registrar pelo menos 10 aulas no diário.',
    icone: 'diario',
    cor: 'verde',
    pontos: 20,
    perfis: ['PROFESSOR'],
  },
  {
    codigo: 'avaliador',
    titulo: 'Avaliador',
    descricao: 'Lançar notas em pelo menos 5 avaliações.',
    icone: 'boletim',
    cor: 'laranja',
    pontos: 20,
    perfis: ['PROFESSOR'],
  },
  {
    codigo: 'orientador',
    titulo: 'Orientador',
    descricao: 'Orientar ou coorientar pelo menos um projeto de pesquisa.',
    icone: 'pos',
    cor: 'roxo',
    pontos: 20,
    perfis: ['PROFESSOR'],
  },
  {
    codigo: 'banca',
    titulo: 'Membro de banca',
    descricao: 'Participar de pelo menos uma banca.',
    icone: 'pos',
    cor: 'roxo',
    pontos: 20,
    perfis: ['PROFESSOR'],
  },
  {
    codigo: 'turma-nota-alta',
    titulo: 'Turma nota alta',
    descricao: 'Ter uma turma com média de notas finais de 8,0 ou mais.',
    icone: 'grafico',
    cor: 'laranja',
    pontos: 30,
    perfis: ['PROFESSOR'],
  },
];

export function catalogoDoPerfil(perfil: Perfil): DefinicaoMedalha[] {
  return CATALOGO_AUTOMATICO.filter((def) =>
    (def.perfis as Perfil[]).includes(perfil)
  );
}

// ---------- Funções auxiliares ----------

const FAIXAS_NIVEL: readonly { pontos: number; titulo: string }[] = [
  { pontos: 0, titulo: 'Iniciante' },
  { pontos: 50, titulo: 'Dedicado' },
  { pontos: 120, titulo: 'Destaque' },
  { pontos: 220, titulo: 'Exemplar' },
  { pontos: 350, titulo: 'Lendário' },
];

export function calcularNivel(pontos: number): NivelDTO {
  let indice = 0;
  for (let i = 0; i < FAIXAS_NIVEL.length; i++) {
    if (pontos >= FAIXAS_NIVEL[i].pontos) indice = i;
  }
  const faixa = FAIXAS_NIVEL[indice];
  const proxima = FAIXAS_NIVEL[indice + 1];
  return {
    pontos,
    nivel: indice + 1,
    titulo: faixa.titulo,
    pontosDoNivel: faixa.pontos,
    pontosProximoNivel: proxima ? proxima.pontos : null,
  };
}

function progressoEm(atual: number, meta: number): Progresso {
  return { atual: Math.min(atual, meta), meta };
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function inicioDeHoje(): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

// ---------- Carga de dados (poucas consultas, nenhuma em laço) ----------

// Dados que valem para aluno e professor (leitor e voz-ativa).
async function carregarComuns(usuarioId: number) {
  const [emprestimos, publicacoes, comentarios] = await Promise.all([
    prisma.emprestimo.count({ where: { usuarioId } }),
    prisma.forumPublicacao.count({ where: { autorId: usuarioId, removida: false } }),
    prisma.forumComentario.count({ where: { autorId: usuarioId, removido: false } }),
  ]);
  return { emprestimos, participacoesForum: publicacoes + comentarios };
}

async function carregarAluno(alunoId: number) {
  const hoje = inicioDeHoje();
  const [matriculas, inscricoes, notas, pagas, atrasadas, projetos] = await Promise.all([
    prisma.matricula.count({ where: { alunoId } }),
    prisma.inscricao.findMany({
      where: { matricula: { alunoId } },
      select: { status: true, notaFinal: true, frequencia: true },
    }),
    prisma.nota.findMany({
      where: { inscricao: { matricula: { alunoId } } },
      select: { valor: true, avaliacao: { select: { notaMaxima: true } } },
    }),
    prisma.mensalidade.count({ where: { status: 'PAGA', matricula: { alunoId } } }),
    prisma.mensalidade.count({
      where: {
        matricula: { alunoId },
        OR: [{ status: 'ATRASADA' }, { status: 'ABERTA', vencimento: { lt: hoje } }],
      },
    }),
    prisma.projetoPesquisa.findMany({
      where: { matricula: { alunoId } },
      select: { status: true },
    }),
  ]);
  return { matriculas, inscricoes, notas, pagas, atrasadas, projetos };
}

async function carregarProfessor(professorId: number) {
  const [turmas, aulas, avaliacoes, orientacoes, bancas] = await Promise.all([
    prisma.turma.findMany({
      where: { professorId },
      select: {
        periodoLetivo: { select: { ativo: true } },
        inscricoes: { where: { notaFinal: { not: null } }, select: { notaFinal: true } },
      },
    }),
    prisma.aula.count({ where: { turma: { professorId } } }),
    prisma.avaliacao.count({ where: { turma: { professorId }, notas: { some: {} } } }),
    prisma.projetoPesquisa.count({
      where: { OR: [{ orientadorId: professorId }, { coorientadorId: professorId }] },
    }),
    prisma.bancaMembro.count({ where: { professorId } }),
  ]);
  return { turmas, aulas, avaliacoes, orientacoes, bancas };
}

// ---------- Regras ----------

function regrasAluno(
  dados: Awaited<ReturnType<typeof carregarAluno>>,
  comuns: Awaited<ReturnType<typeof carregarComuns>>
): Map<string, Resultado> {
  const mapa = new Map<string, Resultado>();
  const aprovadas = dados.inscricoes.filter((i) => i.status === 'APROVADO').length;
  const freqs = dados.inscricoes
    .map((i) => i.frequencia)
    .filter((f): f is number => f !== null);
  const finais = dados.inscricoes
    .map((i) => i.notaFinal)
    .filter((n): n is number => n !== null);
  const mediaFreq = media(freqs);
  const mediaFinal = media(finais);

  mapa.set('primeiros-passos', { conquistada: dados.matriculas >= 1, progresso: null });
  mapa.set('presenca-total', {
    conquistada: dados.inscricoes.some((i) => i.frequencia === 100 && i.status !== 'TRANCADO'),
    progresso: null,
  });
  mapa.set('assiduo', {
    conquistada: freqs.length >= 2 && (mediaFreq ?? 0) >= 90,
    progresso: null,
  });
  mapa.set('nota-dez', {
    conquistada: dados.notas.some((n) => n.valor === n.avaliacao.notaMaxima),
    progresso: null,
  });
  mapa.set('excelencia', {
    conquistada: finais.length >= 2 && (mediaFinal ?? 0) >= 9,
    progresso: null,
  });
  mapa.set('aprovado', { conquistada: aprovadas >= 1, progresso: progressoEm(aprovadas, 1) });
  mapa.set('maratonista', { conquistada: aprovadas >= 5, progresso: progressoEm(aprovadas, 5) });
  mapa.set('leitor', { conquistada: comuns.emprestimos >= 1, progresso: null });
  mapa.set('rato-de-biblioteca', {
    conquistada: comuns.emprestimos >= 5,
    progresso: progressoEm(comuns.emprestimos, 5),
  });
  mapa.set('em-dia', {
    conquistada: dados.pagas >= 3 && dados.atrasadas === 0,
    progresso: null,
  });
  mapa.set('pesquisador', { conquistada: dados.projetos.length >= 1, progresso: null });
  mapa.set('mestre-da-banca', {
    conquistada: dados.projetos.some((p) => p.status === 'QUALIFICADO' || p.status === 'APROVADO'),
    progresso: null,
  });
  mapa.set('voz-ativa', {
    conquistada: comuns.participacoesForum >= 3,
    progresso: progressoEm(comuns.participacoesForum, 3),
  });
  return mapa;
}

function regrasProfessor(
  dados: Awaited<ReturnType<typeof carregarProfessor>>,
  comuns: Awaited<ReturnType<typeof carregarComuns>>
): Map<string, Resultado> {
  const mapa = new Map<string, Resultado>();
  mapa.set('mestre', {
    conquistada: dados.turmas.some((t) => t.periodoLetivo.ativo),
    progresso: null,
  });
  mapa.set('diario-em-dia', {
    conquistada: dados.aulas >= 10,
    progresso: progressoEm(dados.aulas, 10),
  });
  mapa.set('avaliador', {
    conquistada: dados.avaliacoes >= 5,
    progresso: progressoEm(dados.avaliacoes, 5),
  });
  mapa.set('orientador', { conquistada: dados.orientacoes >= 1, progresso: null });
  mapa.set('banca', { conquistada: dados.bancas >= 1, progresso: null });
  mapa.set('turma-nota-alta', {
    conquistada: dados.turmas.some((t) => {
      const notas = t.inscricoes
        .map((i) => i.notaFinal)
        .filter((n): n is number => n !== null);
      return notas.length >= 2 && (media(notas) ?? 0) >= 8;
    }),
    progresso: null,
  });
  mapa.set('leitor', { conquistada: comuns.emprestimos >= 1, progresso: null });
  mapa.set('voz-ativa', {
    conquistada: comuns.participacoesForum >= 3,
    progresso: progressoEm(comuns.participacoesForum, 3),
  });
  return mapa;
}

// Resultado (conquistada e progresso) de cada medalha automática do perfil.
async function avaliarAutomaticas(usuario: UsuarioMedalhas): Promise<Map<string, Resultado>> {
  if (usuario.perfil === 'ALUNO') {
    if (usuario.alunoId === null) {
      // Sem cadastro de aluno: nenhuma matrícula, nenhum dado acadêmico.
      const comuns = await carregarComuns(usuario.id);
      return regrasAluno(
        { matriculas: 0, inscricoes: [], notas: [], pagas: 0, atrasadas: 0, projetos: [] },
        comuns
      );
    }
    const [dados, comuns] = await Promise.all([
      carregarAluno(usuario.alunoId),
      carregarComuns(usuario.id),
    ]);
    return regrasAluno(dados, comuns);
  }
  if (usuario.perfil === 'PROFESSOR') {
    const comuns = await carregarComuns(usuario.id);
    if (usuario.professorId === null) {
      return regrasProfessor(
        { turmas: [], aulas: 0, avaliacoes: 0, orientacoes: 0, bancas: 0 },
        comuns
      );
    }
    const dados = await carregarProfessor(usuario.professorId);
    return regrasProfessor(dados, comuns);
  }
  return new Map();
}

// ---------- API do módulo ----------

// Só as automáticas do perfil, com conquistada e progresso (sem as manuais).
export async function calcularAutomaticas(usuario: UsuarioMedalhas): Promise<MedalhaDTO[]> {
  const definicoes = catalogoDoPerfil(usuario.perfil);
  if (definicoes.length === 0) return [];
  const resultados = await avaliarAutomaticas(usuario);
  return definicoes.map((def) => {
    const r = resultados.get(def.codigo) ?? { conquistada: false, progresso: null };
    return {
      codigo: def.codigo,
      titulo: def.titulo,
      descricao: def.descricao,
      icone: def.icone,
      cor: def.cor,
      pontos: def.pontos,
      conquistada: r.conquistada,
      conquistadaEm: null,
      manual: false,
      id: null,
      concedidaPor: null,
      progresso: r.progresso,
    };
  });
}

// Automáticas do perfil (calculadas) seguidas das manuais do banco.
export async function calcularMedalhas(usuario: UsuarioMedalhas): Promise<MedalhaDTO[]> {
  const automaticas = await calcularAutomaticas(usuario);
  const concedidas = await prisma.medalhaConcedida.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { id: 'asc' },
  });
  if (concedidas.length === 0) return automaticas;

  const idsQuemConcedeu = [...new Set(concedidas.map((m) => m.concedidaPorId))];
  const quem = await prisma.usuario.findMany({
    where: { id: { in: idsQuemConcedeu } },
    select: { id: true, nome: true },
  });
  const nomes = new Map(quem.map((u) => [u.id, u.nome]));

  const manuais: MedalhaDTO[] = concedidas.map((m) => ({
    codigo: 'manual-' + m.id,
    titulo: m.titulo,
    descricao: m.descricao ?? '',
    icone: m.icone,
    cor: (['azul', 'roxo', 'verde', 'laranja'].includes(m.cor) ? m.cor : 'azul') as CorMedalha,
    pontos: m.pontos,
    conquistada: true,
    conquistadaEm: m.criadoEm.toISOString(),
    manual: true,
    id: m.id,
    concedidaPor: nomes.get(m.concedidaPorId) ?? null,
    progresso: null,
  }));
  return [...automaticas, ...manuais];
}
