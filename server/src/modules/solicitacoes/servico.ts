import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Prisma, StatusSolicitacao, TipoSolicitacao } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/erros';
import { apagarArquivosDe, arquivosDe, ArquivoDTO } from '../../lib/arquivos';
import { emailHabilitado, enderecoDoSite, enfileirarEmail } from '../../lib/email';
import { notificar } from '../../lib/notificacoes';
import { avisarBoasVindas, criarAlunoNoBanco, DadosAluno, geradorRA } from '../cadastros/importacao';
import { ResultadoVinculo, vincularResponsavel } from '../responsaveis/servico';

// Matrícula e rematrícula online (sétima leva, Contrato D em docs/plano/setima-leva.md).

// ---------- Constantes ----------

// Sem 0, O, 1 e I: a chave é digitada à mão por quem acompanha o pedido.
export const ALFABETO_CHAVE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TAMANHO_CHAVE = 10;
export const STATUS_ABERTOS: StatusSolicitacao[] = ['ENVIADA', 'EM_ANALISE', 'PENDENTE'];
export const STATUS_CONCLUIDOS: StatusSolicitacao[] = ['APROVADA', 'RECUSADA'];
export const STATUS_ENVIO_DOCUMENTOS: StatusSolicitacao[] = ['ENVIADA', 'PENDENTE'];
export const MAX_DOCUMENTOS_POR_PEDIDO = 6;
export const LIMITE_DOCUMENTO_BYTES = 10 * 1024 * 1024;
export const EXTENSOES_DOCUMENTO = ['pdf', 'jpg', 'jpeg', 'png'];
export const MENSAGEM_NAO_ENCONTRADO = 'Protocolo ou chave não encontrados';
export const MENSAGEM_LIMITE = 'Muitas tentativas. Aguarde um pouco e tente de novo.';
export const MENSAGEM_CONCLUIDO = 'Esta solicitação já foi concluída';

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

// ---------- Chaves e protocolos ----------

// Texto aleatório com o alfabeto da chave (usado na chave de acompanhamento e na senha inicial).
export function gerarTextoAleatorio(tamanho: number): string {
  let texto = '';
  for (let i = 0; i < tamanho; i++) {
    texto += ALFABETO_CHAVE[crypto.randomInt(ALFABETO_CHAVE.length)];
  }
  return texto;
}

export function hashChave(chave: string): string {
  return crypto.createHash('sha256').update(chave).digest('hex');
}

// Hash de referência para comparar quando não há pedido (o tempo de resposta fica igual).
export const HASH_FALSO = hashChave('');

// Confere a chave digitada com o SHA-256 guardado. Sem diferenciar maiúsculas nem espaços nas pontas.
export function conferirChave(chaveInformada: string, hashGuardado: string): boolean {
  const calculado = Buffer.from(hashChave(chaveInformada.trim().toUpperCase()), 'hex');
  const guardado = Buffer.from(hashGuardado, 'hex');
  return guardado.length === calculado.length && crypto.timingSafeEqual(calculado, guardado);
}

export function protocoloDe(id: number, ano: number): string {
  return `${ano}-${String(id).padStart(6, '0')}`;
}

// Protocolo de resposta falsa (armadilha para robôs): mesmo formato, nada gravado.
export function protocoloFalso(): string {
  return `${new Date().getFullYear()}-${String(crypto.randomInt(1, 999999)).padStart(6, '0')}`;
}

// ---------- Limitador por IP (em memória) ----------

export function criarLimitador(limite: number, janelaMs: number): (ip: string) => boolean {
  const registros = new Map<string, number[]>();

  const limpar = (): void => {
    const agora = Date.now();
    for (const [ip, instantes] of registros) {
      const recentes = instantes.filter((instante) => agora - instante < janelaMs);
      if (recentes.length === 0) {
        registros.delete(ip);
      } else {
        registros.set(ip, recentes);
      }
    }
  };
  setInterval(limpar, janelaMs).unref();

  return (ip: string): boolean => {
    const agora = Date.now();
    const recentes = (registros.get(ip) ?? []).filter((instante) => agora - instante < janelaMs);
    if (recentes.length >= limite) {
      registros.set(ip, recentes);
      return false;
    }
    recentes.push(agora);
    registros.set(ip, recentes);
    return true;
  };
}

export const limitarCriacao = criarLimitador(5, HORA_MS);
export const limitarAcompanhamento = criarLimitador(20, MINUTO_MS);
export const limitarDocumentos = criarLimitador(30, HORA_MS);

// ---------- Consultas e criação ----------

export const incluiCurso = { curso: { select: { id: true, nome: true, nivel: true } } } as const;
export type PedidoComCurso = Prisma.SolicitacaoMatriculaGetPayload<{ include: typeof incluiCurso }>;

export interface CursoResumo {
  id: number;
  nome: string;
  nivel: string;
}

export interface SolicitacaoResumoDTO {
  id: number;
  protocolo: string;
  tipo: TipoSolicitacao;
  status: StatusSolicitacao;
  nome: string;
  curso: CursoResumo;
  criadoEm: string;
  atualizadoEm: string;
  documentos: number;
}

export interface SolicitacaoDTO extends Omit<SolicitacaoResumoDTO, 'documentos'> {
  email: string;
  cpf: string | null;
  dataNascimento: string;
  telefone: string | null;
  endereco: string | null;
  responsavelNome: string | null;
  responsavelEmail: string | null;
  responsavelTelefone: string | null;
  responsavelParentesco: string | null;
  observacao: string;
  parecer: string;
  periodoLetivo: { id: number; nome: string } | null;
  alunoId: number | null;
  matriculaId: number | null;
  analisadoPor: { id: number; nome: string } | null;
  analisadoEm: string | null;
  documentos: ArquivoDTO[];
}

export async function carregarPedido(id: number): Promise<PedidoComCurso | null> {
  return prisma.solicitacaoMatricula.findUnique({ where: { id }, include: incluiCurso });
}

// Cria a linha com protocolo provisório (único) e troca pelo protocolo definitivo na mesma transação.
export async function criarComProtocolo(
  dados: Omit<Prisma.SolicitacaoMatriculaUncheckedCreateInput, 'protocolo'>
): Promise<PedidoComCurso> {
  return prisma.$transaction(async (tx) => {
    const provisorio = 'PROV-' + crypto.randomBytes(12).toString('hex');
    const criada = await tx.solicitacaoMatricula.create({ data: { ...dados, protocolo: provisorio } });
    return tx.solicitacaoMatricula.update({
      where: { id: criada.id },
      data: { protocolo: protocoloDe(criada.id, criada.criadoEm.getFullYear()) },
      include: incluiCurso,
    });
  });
}

// Períodos ativos cujo fim é hoje ou depois.
export async function periodosAbertos(): Promise<{ id: number; nome: string }[]> {
  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);
  return prisma.periodoLetivo.findMany({
    where: { ativo: true, fim: { gte: inicioDeHoje } },
    select: { id: true, nome: true },
    orderBy: { inicio: 'asc' },
  });
}

// ---------- Conversões para DTO ----------

function dataSimples(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function paraResumo(pedido: PedidoComCurso, documentos: number): SolicitacaoResumoDTO {
  return {
    id: pedido.id,
    protocolo: pedido.protocolo,
    tipo: pedido.tipo,
    status: pedido.status,
    nome: pedido.nome,
    curso: { id: pedido.curso.id, nome: pedido.curso.nome, nivel: pedido.curso.nivel },
    criadoEm: pedido.criadoEm.toISOString(),
    atualizadoEm: pedido.atualizadoEm.toISOString(),
    documentos,
  };
}

export async function paraDTO(pedido: PedidoComCurso): Promise<SolicitacaoDTO> {
  const [periodo, analisador, documentos] = await Promise.all([
    pedido.periodoLetivoId === null
      ? Promise.resolve(null)
      : prisma.periodoLetivo.findUnique({ where: { id: pedido.periodoLetivoId }, select: { id: true, nome: true } }),
    pedido.analisadoPorId === null
      ? Promise.resolve(null)
      : prisma.usuario.findUnique({ where: { id: pedido.analisadoPorId }, select: { id: true, nome: true } }),
    arquivosDe('SOLICITACAO', [pedido.id]),
  ]);
  return {
    id: pedido.id,
    protocolo: pedido.protocolo,
    tipo: pedido.tipo,
    status: pedido.status,
    nome: pedido.nome,
    curso: { id: pedido.curso.id, nome: pedido.curso.nome, nivel: pedido.curso.nivel },
    criadoEm: pedido.criadoEm.toISOString(),
    atualizadoEm: pedido.atualizadoEm.toISOString(),
    email: pedido.email,
    cpf: pedido.cpf,
    dataNascimento: dataSimples(pedido.dataNascimento),
    telefone: pedido.telefone,
    endereco: pedido.endereco,
    responsavelNome: pedido.responsavelNome,
    responsavelEmail: pedido.responsavelEmail,
    responsavelTelefone: pedido.responsavelTelefone,
    responsavelParentesco: pedido.responsavelParentesco,
    observacao: pedido.observacao,
    parecer: pedido.parecer,
    periodoLetivo: periodo,
    alunoId: pedido.alunoId,
    matriculaId: pedido.matriculaId,
    analisadoPor: analisador,
    analisadoEm: pedido.analisadoEm ? pedido.analisadoEm.toISOString() : null,
    documentos: documentos.get(pedido.id) ?? [],
  };
}

// ---------- E-mails e avisos (sempre em segundo plano, nunca derrubam a resposta) ----------

const ROTULO_STATUS: Record<StatusSolicitacao, string> = {
  ENVIADA: 'Recebida',
  EM_ANALISE: 'Em análise',
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
};

const MENSAGEM_STATUS: Record<StatusSolicitacao, string> = {
  ENVIADA: 'Recebemos o seu pedido e ele entrou na fila da secretaria.',
  EM_ANALISE: 'A secretaria está analisando o seu pedido.',
  PENDENTE: 'Falta um documento ou uma informação para concluir o pedido. Veja o parecer e envie o que for preciso.',
  APROVADA: 'O seu pedido foi aprovado pela secretaria.',
  RECUSADA: 'O seu pedido não foi aprovado.',
};

// E-mail de confirmação da matrícula online: com o protocolo, sem a chave.
export function avisarRecebimento(pedido: PedidoComCurso): void {
  enfileirarEmail({
    para: pedido.email,
    assunto: `Pedido de matrícula ${pedido.protocolo} recebido`,
    titulo: 'Recebemos o seu pedido de matrícula',
    paragrafos: [
      `Curso: ${pedido.curso.nome}.`,
      `Protocolo: ${pedido.protocolo}.`,
      'Use o protocolo e a chave de acompanhamento mostrados na tela para acompanhar o pedido e enviar documentos. A chave não é enviada por e-mail.',
    ],
    tipo: 'SECRETARIA',
  });
}

// Mudança de status: e-mail para o e-mail do pedido e aviso no sino de quem pediu (rematrícula).
export function avisarMudanca(pedido: PedidoComCurso): void {
  const rotulo = ROTULO_STATUS[pedido.status];
  const parecer = pedido.parecer.trim();
  enfileirarEmail({
    para: pedido.email,
    assunto: `Pedido ${pedido.protocolo}: ${rotulo}`,
    titulo: `Seu pedido está: ${rotulo}`,
    paragrafos: [
      `Protocolo: ${pedido.protocolo}.`,
      MENSAGEM_STATUS[pedido.status],
      ...(parecer ? [`Parecer da secretaria: ${parecer}`] : []),
    ],
    tipo: 'SECRETARIA',
  });
  if (pedido.solicitanteId) {
    notificar([pedido.solicitanteId], {
      tipo: 'SECRETARIA',
      titulo: `Pedido ${pedido.protocolo}: ${rotulo}`,
      texto: parecer || rotulo,
      link: '/rematricula',
      chave: `solicitacao-${pedido.id}-${pedido.status}`,
    });
  }
}

// ---------- Mudança de status (PUT /solicitacoes/:id/status) ----------

export async function alterarStatus(
  id: number,
  status: 'EM_ANALISE' | 'PENDENTE' | 'RECUSADA',
  parecer: string | undefined
): Promise<SolicitacaoDTO> {
  const pedido = await carregarPedido(id);
  if (!pedido) throw new HttpError(404, 'Solicitação não encontrada');
  if (STATUS_CONCLUIDOS.includes(pedido.status)) throw new HttpError(409, MENSAGEM_CONCLUIDO);

  const parecerEfetivo = parecer !== undefined ? parecer : pedido.parecer;
  if ((status === 'PENDENTE' || status === 'RECUSADA') && parecerEfetivo.trim() === '') {
    throw new HttpError(400, 'Informe o parecer para pedir complemento ou recusar');
  }

  const { count } = await prisma.solicitacaoMatricula.updateMany({
    where: { id, status: { notIn: STATUS_CONCLUIDOS } },
    data: { status, ...(parecer !== undefined ? { parecer } : {}) },
  });
  if (count !== 1) throw new HttpError(409, MENSAGEM_CONCLUIDO);

  const atualizado = await carregarPedido(id);
  if (!atualizado) throw new HttpError(404, 'Solicitação não encontrada');
  avisarMudanca(atualizado);
  return paraDTO(atualizado);
}

// ---------- Aprovação (POST /solicitacoes/:id/aprovar) ----------

export interface CorpoAprovacao {
  parecer?: string;
  avancarSerie?: boolean;
  criarResponsavel?: boolean;
}

export interface ResultadoAprovacao {
  solicitacao: SolicitacaoDTO;
  senhaInicial: string | null;
  responsavel: ResultadoVinculo | null;
}

// Marca o pedido como APROVADA só se ele ainda estiver aberto (dentro da mesma transação).
async function marcarAprovada(
  tx: Prisma.TransactionClient,
  id: number,
  adminId: number,
  parecer: string | undefined,
  extra: { alunoId?: number; matriculaId?: number }
): Promise<void> {
  const { count } = await tx.solicitacaoMatricula.updateMany({
    where: { id, status: { in: STATUS_ABERTOS } },
    data: {
      status: 'APROVADA',
      analisadoPorId: adminId,
      analisadoEm: new Date(),
      ...(parecer !== undefined ? { parecer } : {}),
      ...extra,
    },
  });
  if (count !== 1) throw new HttpError(409, MENSAGEM_CONCLUIDO);
}

// Período da matrícula: o do pedido ou, sem ele, o ativo mais recente.
async function periodoParaMatricula(periodoId: number | null): Promise<{ id: number }> {
  if (periodoId !== null) {
    const escolhido = await prisma.periodoLetivo.findUnique({ where: { id: periodoId }, select: { id: true } });
    if (!escolhido) throw new HttpError(400, 'O período letivo do pedido não existe');
    return escolhido;
  }
  const ativo = await prisma.periodoLetivo.findFirst({
    where: { ativo: true },
    orderBy: [{ inicio: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  if (!ativo) throw new HttpError(400, 'Não há período letivo ativo para fazer a matrícula');
  return ativo;
}

function dadosAlunoDoPedido(pedido: PedidoComCurso): DadosAluno {
  return {
    nome: pedido.nome,
    email: pedido.email,
    cpf: pedido.cpf,
    telefone: pedido.telefone,
    dataNascimento: dataSimples(pedido.dataNascimento),
    endereco: pedido.endereco,
    responsavelNome: pedido.responsavelNome,
    responsavelTelefone: pedido.responsavelTelefone,
    responsavelEmail: pedido.responsavelEmail,
  };
}

async function aprovarNova(
  pedido: PedidoComCurso,
  adminId: number,
  corpo: CorpoAprovacao
): Promise<{ senhaInicial: string | null; responsavel: ResultadoVinculo | null }> {
  const usado = await prisma.usuario.findFirst({
    where: { email: { equals: pedido.email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (usado) {
    throw new HttpError(409, 'Já existe um usuário com este e-mail; faça a matrícula pelo cadastro do aluno');
  }
  const periodo = await periodoParaMatricula(pedido.periodoLetivoId);

  // Convite "Criar minha senha" só com o e-mail de boas-vindas ativo e o endereço do site definido.
  const convite = (await emailHabilitado('BOAS_VINDAS')) && (await enderecoDoSite()) !== null;
  const senhaInicial = convite ? null : gerarTextoAleatorio(10);
  const senhaHash = await bcrypt.hash(senhaInicial ?? gerarTextoAleatorio(32), 10);

  const aluno = await prisma.$transaction(async (tx) => {
    const proximoRA = await geradorRA(tx);
    const criado = await criarAlunoNoBanco(tx, dadosAlunoDoPedido(pedido), senhaHash, proximoRA());
    const matricula = await tx.matricula.create({
      data: {
        alunoId: criado.id,
        cursoId: pedido.cursoId,
        periodoIngressoId: periodo.id,
        status: 'ATIVA',
        serieAtual: 1,
      },
    });
    await marcarAprovada(tx, pedido.id, adminId, corpo.parecer, {
      alunoId: criado.id,
      matriculaId: matricula.id,
    });
    return criado;
  });

  if (convite) {
    avisarBoasVindas(aluno.usuario);
  }

  // Falha aqui não desfaz a matrícula: devolve responsavel null.
  let responsavel: ResultadoVinculo | null = null;
  if (corpo.criarResponsavel && pedido.responsavelEmail) {
    try {
      responsavel = await vincularResponsavel(aluno.id, {
        nome: pedido.responsavelNome ?? 'Responsável',
        email: pedido.responsavelEmail,
        telefone: pedido.responsavelTelefone,
        parentesco: pedido.responsavelParentesco ?? 'Responsável',
      });
    } catch (erro) {
      console.error('Falha ao ligar o responsável à matrícula:', erro instanceof Error ? erro.message : erro);
    }
  }
  return { senhaInicial, responsavel };
}

async function aprovarRematricula(
  pedido: PedidoComCurso,
  adminId: number,
  corpo: CorpoAprovacao
): Promise<{ senhaInicial: null; responsavel: null }> {
  if (pedido.matriculaId === null) {
    throw new HttpError(409, 'Esta rematrícula não tem matrícula para renovar');
  }
  const matriculaId = pedido.matriculaId;
  await prisma.$transaction(async (tx) => {
    const matricula = await tx.matricula.findUnique({
      where: { id: matriculaId },
      include: { curso: { select: { duracaoPeriodos: true } } },
    });
    if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');
    const serieAtual =
      corpo.avancarSerie === true && matricula.serieAtual < matricula.curso.duracaoPeriodos
        ? matricula.serieAtual + 1
        : matricula.serieAtual;
    await tx.matricula.update({ where: { id: matriculaId }, data: { status: 'ATIVA', serieAtual } });
    await marcarAprovada(tx, pedido.id, adminId, corpo.parecer, {});
  });
  return { senhaInicial: null, responsavel: null };
}

export async function aprovarSolicitacao(
  id: number,
  adminId: number,
  corpo: CorpoAprovacao
): Promise<ResultadoAprovacao> {
  const pedido = await carregarPedido(id);
  if (!pedido) throw new HttpError(404, 'Solicitação não encontrada');
  if (STATUS_CONCLUIDOS.includes(pedido.status)) throw new HttpError(409, MENSAGEM_CONCLUIDO);

  const resultado =
    pedido.tipo === 'NOVA' ? await aprovarNova(pedido, adminId, corpo) : await aprovarRematricula(pedido, adminId, corpo);

  const atualizado = await carregarPedido(id);
  if (!atualizado) throw new HttpError(404, 'Solicitação não encontrada');
  avisarMudanca(atualizado);
  return {
    solicitacao: await paraDTO(atualizado),
    senhaInicial: resultado.senhaInicial,
    responsavel: resultado.responsavel,
  };
}

// ---------- Exclusão (só recusadas) ----------

export async function excluirSolicitacao(id: number): Promise<void> {
  const pedido = await prisma.solicitacaoMatricula.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!pedido) throw new HttpError(404, 'Solicitação não encontrada');
  if (pedido.status !== 'RECUSADA') {
    throw new HttpError(409, 'Só é possível excluir uma solicitação recusada');
  }
  await apagarArquivosDe('SOLICITACAO', [id]);
  await prisma.solicitacaoMatricula.deleteMany({ where: { id, status: 'RECUSADA' } });
}
