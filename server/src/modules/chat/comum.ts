import { Prisma, type ChatMensagem, type Perfil } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/erros';
import { estaOnline, quemDigita, JANELA_ONLINE_MS, ultimoVisto } from './estado';
import type { UsuarioToken } from '../../lib/auth';

// Tipos do Contrato C (docs/plano/quarta-leva.md). Datas saem como ISO (string).

export type EstadoEnvio = 'ENVIADA' | 'ENTREGUE' | 'LIDA';

export interface PessoaChat {
  id: number;
  nome: string;
  perfil: Perfil;
  foto: string | null;
  online: boolean;
}

export interface MensagemChat {
  id: number;
  conversaId: number;
  autor: { id: number; nome: string; foto: string | null };
  texto: string;
  imagem: string | null;
  apagada: boolean;
  sistema: boolean;
  respostaA: { id: number; autorNome: string; texto: string; temImagem: boolean; apagada: boolean } | null;
  criadaEm: string;
  minha: boolean;
  estado: EstadoEnvio | null;
}

export interface ConversaChat {
  id: number;
  tipo: 'INDIVIDUAL' | 'GRUPO';
  nome: string;
  foto: string | null;
  outro: PessoaChat | null;
  participantes: number;
  souAdmin: boolean;
  ultima: {
    texto: string;
    autorNome: string;
    minha: boolean;
    temImagem: boolean;
    apagada: boolean;
    criadaEm: string;
    estado: EstadoEnvio | null;
  } | null;
  naoLidas: number;
  digitando: string[];
  atualizadaEm: string;
}

export interface ConversaDetalhe extends ConversaChat {
  membros: (PessoaChat & { admin: boolean })[];
}

// Menor "entregue" e menor "lido" entre os outros participantes ativos (null se alguém não tem).
export interface Leitura {
  entregueAte: Date | null;
  lidaAte: Date | null;
}

export interface UsuarioBase {
  id: number;
  nome: string;
  perfil: Perfil;
  foto: string | null;
  ativo: boolean;
}

export interface ParticipanteBase {
  conversaId: number;
  usuarioId: number;
  admin: boolean;
  entrouEm: Date;
  ultimaEntregaEm: Date | null;
  ultimaLeituraEm: Date | null;
}

export interface ConversaBase {
  id: number;
  tipo: 'INDIVIDUAL' | 'GRUPO';
  nome: string | null;
  foto: string | null;
  atualizadaEm: Date;
}

// Tudo o que as rotas de conversa precisam, carregado em poucas consultas (sem N+1).
export interface BaseConversas {
  minhasPorId: Map<number, ParticipanteBase & { conversa: ConversaBase }>;
  todos: Map<number, ParticipanteBase[]>; // participantes ativos por conversa
  ultimas: Map<number, ChatMensagem>; // última mensagem (qualquer, inclusive apagada) por conversa
  naoLidas: Map<number, number>;
  usuarios: Map<number, UsuarioBase>;
}

const SELECT_USUARIO = {
  id: true,
  nome: true,
  perfil: true,
  foto: true,
  ativo: true,
} satisfies Prisma.UsuarioSelect;

// ---------- Auxiliares ----------

export function cortar(texto: string, maximo: number): string {
  const caracteres = Array.from(texto);
  return caracteres.length > maximo ? caracteres.slice(0, maximo).join('') : texto;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function pessoa(u: UsuarioBase): PessoaChat {
  return { id: u.id, nome: u.nome, perfil: u.perfil, foto: u.foto, online: estaOnline(u.id) };
}

export async function usuariosPorId(ids: number[]): Promise<Map<number, UsuarioBase>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) {
    return new Map<number, UsuarioBase>();
  }
  const lista = await prisma.usuario.findMany({ where: { id: { in: unicos } }, select: SELECT_USUARIO });
  return new Map(lista.map((u): [number, UsuarioBase] => [u.id, u]));
}

function menorData(valores: (Date | null)[]): Date | null {
  let menor: Date | null = null;
  for (const valor of valores) {
    if (valor === null) {
      return null;
    }
    if (menor === null || valor.getTime() < menor.getTime()) {
      menor = valor;
    }
  }
  return menor;
}

export function leituraDos(outros: { ultimaEntregaEm: Date | null; ultimaLeituraEm: Date | null }[]): Leitura {
  if (outros.length === 0) {
    return { entregueAte: null, lidaAte: null };
  }
  return {
    entregueAte: menorData(outros.map((o) => o.ultimaEntregaEm)),
    lidaAte: menorData(outros.map((o) => o.ultimaLeituraEm)),
  };
}

// Estado de uma mensagem minha: LIDA / ENTREGUE quando todos os outros já receberam ou leram.
export function estadoDaMensagem(criadaEm: Date, leitura: Leitura): EstadoEnvio {
  if (leitura.lidaAte !== null && leitura.lidaAte.getTime() >= criadaEm.getTime()) {
    return 'LIDA';
  }
  if (leitura.entregueAte !== null && leitura.entregueAte.getTime() >= criadaEm.getTime()) {
    return 'ENTREGUE';
  }
  return 'ENVIADA';
}

export function iso(data: Date): string {
  return data.toISOString();
}

// ---------- Quem pode ser encontrado (contatos e conversas individuais) ----------

// Responsável: fala com a equipe (ADMIN, TI, SECRETARIA) e com os professores das turmas dos alunos ligados a ele.
function condicaoContatosDoResponsavel(usuarioId: number): Prisma.UsuarioWhereInput {
  return {
    OR: [
      { perfil: { in: ['ADMIN', 'TI', 'SECRETARIA'] } },
      {
        perfil: 'PROFESSOR',
        professor: {
          turmas: {
            some: {
              inscricoes: {
                some: {
                  status: { not: 'TRANCADO' },
                  matricula: { aluno: { responsaveis: { some: { usuarioId } } } },
                },
              },
            },
          },
        },
      },
    ],
  };
}

// Professor: vê os responsáveis dos alunos das turmas dele (quem não tem vínculo fica de fora).
function condicaoResponsaveisDasTurmas(professorId: number): Prisma.UsuarioWhereInput {
  return {
    perfil: 'RESPONSAVEL',
    alunosSobResponsabilidade: {
      some: {
        aluno: {
          matriculas: {
            some: {
              inscricoes: { some: { status: { not: 'TRANCADO' }, turma: { professorId } } },
            },
          },
        },
      },
    },
  };
}

// Filtro de usuários que a pessoa pode encontrar e abrir conversa. Responsável nunca aparece para aluno,
// nem para outro responsável; ADMIN, TI e SECRETARIA veem todos (inclusive responsáveis).
export function filtroDeContatos(usuario: UsuarioToken): Prisma.UsuarioWhereInput {
  if (usuario.perfil === 'RESPONSAVEL') {
    return condicaoContatosDoResponsavel(usuario.id);
  }
  if (usuario.perfil === 'ADMIN' || usuario.perfil === 'SECRETARIA') {
    return {};
  }
  const semResponsaveis: Prisma.UsuarioWhereInput = { perfil: { not: 'RESPONSAVEL' } };
  if (usuario.perfil === 'PROFESSOR' && usuario.professorId !== null) {
    return { OR: [semResponsaveis, condicaoResponsaveisDasTurmas(usuario.professorId)] };
  }
  return semResponsaveis;
}

// Só participantes ativos acessam a conversa; senão 404.
export async function participacaoAtiva(conversaId: number, usuarioId: number): Promise<ParticipanteBase> {
  const participacao = await prisma.chatParticipante.findFirst({
    where: { conversaId, usuarioId, saiuEm: null },
  });
  if (!participacao) {
    throw new HttpError(404, 'Conversa não encontrada');
  }
  return participacao;
}

export async function leituraDaConversa(conversaId: number, meuId: number): Promise<Leitura> {
  const outros = await prisma.chatParticipante.findMany({
    where: { conversaId, saiuEm: null, usuarioId: { not: meuId } },
    select: { ultimaEntregaEm: true, ultimaLeituraEm: true },
  });
  return leituraDos(outros);
}

// Não lidas por conversa: mensagens de outros, não de sistema, não apagadas, depois da minha leitura
// (ou da entrada, se nunca li). Uma consulta agregada só.
export async function contarNaoLidas(meuId: number, conversaIds?: number[]): Promise<Map<number, number>> {
  const filtro = conversaIds ? Prisma.sql`AND p."conversaId" IN (${Prisma.join(conversaIds)})` : Prisma.empty;
  const linhas = await prisma.$queryRaw<{ conversaId: number; total: number }[]>(Prisma.sql`
    SELECT p."conversaId" AS "conversaId", COUNT(m.id)::int AS total
    FROM "ChatParticipante" p
    JOIN "ChatMensagem" m ON m."conversaId" = p."conversaId"
    WHERE p."usuarioId" = ${meuId}
      AND p."saiuEm" IS NULL
      ${filtro}
      AND m."autorId" <> ${meuId}
      AND m.sistema = false
      AND m."apagadaEm" IS NULL
      AND m."criadaEm" >= p."entrouEm"
      AND m."criadaEm" > COALESCE(p."ultimaLeituraEm", p."entrouEm")
    GROUP BY p."conversaId"
  `);
  return new Map(linhas.map((l): [number, number] => [l.conversaId, l.total]));
}

// ---------- Carga das conversas ----------

export async function carregarBase(meuId: number, conversaIds?: number[]): Promise<BaseConversas> {
  const vazio: BaseConversas = {
    minhasPorId: new Map(),
    todos: new Map(),
    ultimas: new Map(),
    naoLidas: new Map(),
    usuarios: new Map(),
  };
  if (conversaIds && conversaIds.length === 0) {
    return vazio;
  }

  const minhas = await prisma.chatParticipante.findMany({
    where: { usuarioId: meuId, saiuEm: null, ...(conversaIds ? { conversaId: { in: conversaIds } } : {}) },
    select: {
      conversaId: true,
      usuarioId: true,
      admin: true,
      entrouEm: true,
      ultimaEntregaEm: true,
      ultimaLeituraEm: true,
      conversa: { select: { id: true, tipo: true, nome: true, foto: true, atualizadaEm: true } },
    },
  });
  if (minhas.length === 0) {
    return vazio;
  }

  const ids = minhas.map((p) => p.conversaId);
  const [ativos, ultimasLista, naoLidas] = await Promise.all([
    prisma.chatParticipante.findMany({
      where: { conversaId: { in: ids }, saiuEm: null },
      select: {
        conversaId: true,
        usuarioId: true,
        admin: true,
        entrouEm: true,
        ultimaEntregaEm: true,
        ultimaLeituraEm: true,
      },
    }),
    // Última mensagem de cada conversa, em uma consulta (LATERAL com o índice conversaId + criadaEm).
    prisma.$queryRaw<ChatMensagem[]>(Prisma.sql`
      SELECT m.* FROM unnest(ARRAY[${Prisma.join(ids)}]::int[]) AS c(id)
      CROSS JOIN LATERAL (
        SELECT x.* FROM "ChatMensagem" x
        WHERE x."conversaId" = c.id
        ORDER BY x."criadaEm" DESC, x.id DESC
        LIMIT 1
      ) m
    `),
    contarNaoLidas(meuId, ids),
  ]);

  const usuarios = await usuariosPorId([
    ...ativos.map((a) => a.usuarioId),
    ...ultimasLista.map((m) => m.autorId),
  ]);

  const minhasPorId = new Map<number, ParticipanteBase & { conversa: ConversaBase }>();
  for (const p of minhas) {
    minhasPorId.set(p.conversaId, p);
  }
  const todos = new Map<number, ParticipanteBase[]>();
  for (const a of ativos) {
    const lista = todos.get(a.conversaId);
    if (lista) {
      lista.push(a);
    } else {
      todos.set(a.conversaId, [a]);
    }
  }
  const ultimas = new Map<number, ChatMensagem>();
  for (const m of ultimasLista) {
    ultimas.set(m.conversaId, m);
  }

  return { minhasPorId, todos, ultimas, naoLidas, usuarios };
}

// Conversas minhas, da mais recente para a mais antiga.
export function montarConversas(base: BaseConversas, meuId: number, agora: number = Date.now()): ConversaChat[] {
  const lista: ConversaChat[] = [];

  for (const minha of base.minhasPorId.values()) {
    const conversa = minha.conversa;
    const participantes = base.todos.get(conversa.id) ?? [];
    const outros = participantes.filter((p) => p.usuarioId !== meuId);
    const leitura = leituraDos(outros);

    const individual = conversa.tipo === 'INDIVIDUAL';
    const usuarioOutro = individual && outros.length > 0 ? base.usuarios.get(outros[0].usuarioId) : undefined;
    const outro = individual && usuarioOutro ? pessoa(usuarioOutro) : null;
    const nome = individual ? (usuarioOutro?.nome ?? '') : (conversa.nome ?? '');
    const foto = individual ? (usuarioOutro?.foto ?? null) : conversa.foto;

    let ultima: ConversaChat['ultima'] = null;
    const linha = base.ultimas.get(conversa.id);
    if (linha && linha.criadaEm.getTime() >= minha.entrouEm.getTime()) {
      const apagada = linha.apagadaEm !== null;
      const minhaMensagem = linha.autorId === meuId;
      ultima = {
        texto: apagada ? '' : cortar(linha.texto, 80),
        autorNome: base.usuarios.get(linha.autorId)?.nome ?? '',
        minha: minhaMensagem,
        temImagem: !apagada && linha.imagem !== null,
        apagada,
        criadaEm: iso(linha.criadaEm),
        estado: minhaMensagem && !linha.sistema ? estadoDaMensagem(linha.criadaEm, leitura) : null,
      };
    }

    const digitando: string[] = [];
    for (const id of quemDigita(conversa.id, meuId, agora)) {
      const u = base.usuarios.get(id);
      if (u && outros.some((o) => o.usuarioId === id)) {
        digitando.push(primeiroNome(u.nome));
      }
    }

    lista.push({
      id: conversa.id,
      tipo: conversa.tipo,
      nome,
      foto,
      outro,
      participantes: participantes.length,
      souAdmin: minha.admin,
      ultima,
      naoLidas: base.naoLidas.get(conversa.id) ?? 0,
      digitando,
      atualizadaEm: iso(conversa.atualizadaEm),
    });
  }

  lista.sort((a, b) => (a.atualizadaEm < b.atualizadaEm ? 1 : a.atualizadaEm > b.atualizadaEm ? -1 : 0));
  return lista;
}

// Houve mudança na conversa depois de `desde` (para a sincronização).
export function conversaMudou(c: ConversaChat, base: BaseConversas, meuId: number, desde: Date): boolean {
  const d = desde.getTime();
  const minha = base.minhasPorId.get(c.id);
  if (!minha) {
    return false;
  }
  if (new Date(c.atualizadaEm).getTime() > d) {
    return true;
  }
  if (minha.ultimaLeituraEm !== null && minha.ultimaLeituraEm.getTime() > d) {
    return true;
  }
  if (c.digitando.length > 0) {
    return true;
  }
  // Mudança de presença do outro: qualquer transição em (desde, agora] tem visto > desde - 20 s.
  if (c.outro !== null && (ultimoVisto(c.outro.id) ?? 0) > d - JANELA_ONLINE_MS) {
    return true;
  }
  const outros = base.todos.get(c.id) ?? [];
  return outros.some(
    (o) =>
      o.usuarioId !== meuId &&
      ((o.ultimaEntregaEm?.getTime() ?? 0) > d || (o.ultimaLeituraEm?.getTime() ?? 0) > d)
  );
}

// Mensagens no formato do Contrato C. `leitura` é da conversa (dos outros participantes).
export async function montarMensagens(linhas: ChatMensagem[], meuId: number, leitura: Leitura): Promise<MensagemChat[]> {
  const idsResposta = [
    ...new Set(linhas.map((l) => l.respostaAId).filter((i): i is number => i !== null)),
  ];
  const respostas =
    idsResposta.length > 0 ? await prisma.chatMensagem.findMany({ where: { id: { in: idsResposta } } }) : [];
  const respostasPorId = new Map(respostas.map((r): [number, ChatMensagem] => [r.id, r]));
  const usuarios = await usuariosPorId([
    ...linhas.map((l) => l.autorId),
    ...respostas.map((r) => r.autorId),
  ]);

  return linhas.map((linha): MensagemChat => {
    const apagada = linha.apagadaEm !== null;
    const autor = usuarios.get(linha.autorId);
    const citada = linha.respostaAId !== null ? respostasPorId.get(linha.respostaAId) : undefined;
    const minha = linha.autorId === meuId;
    return {
      id: linha.id,
      conversaId: linha.conversaId,
      autor: { id: linha.autorId, nome: autor?.nome ?? '', foto: autor?.foto ?? null },
      texto: apagada ? '' : linha.texto,
      imagem: apagada ? null : linha.imagem,
      apagada,
      sistema: linha.sistema,
      respostaA: citada
        ? {
            id: citada.id,
            autorNome: usuarios.get(citada.autorId)?.nome ?? '',
            texto: citada.apagadaEm !== null ? '' : cortar(citada.texto, 120),
            temImagem: citada.apagadaEm === null && citada.imagem !== null,
            apagada: citada.apagadaEm !== null,
          }
        : null,
      criadaEm: iso(linha.criadaEm),
      minha,
      estado: minha && !linha.sistema ? estadoDaMensagem(linha.criadaEm, leitura) : null,
    };
  });
}

// Detalhe de uma conversa minha (ConversaDetalhe). 404 se não sou participante ativo.
export async function detalheConversa(meuId: number, conversaId: number): Promise<ConversaDetalhe> {
  await participacaoAtiva(conversaId, meuId);
  const base = await carregarBase(meuId, [conversaId]);
  const [conversa] = montarConversas(base, meuId);
  if (!conversa) {
    throw new HttpError(404, 'Conversa não encontrada');
  }
  const membros = (base.todos.get(conversaId) ?? [])
    .flatMap((p) => {
      const u = base.usuarios.get(p.usuarioId);
      return u ? [{ ...pessoa(u), admin: p.admin }] : [];
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { ...conversa, membros };
}
