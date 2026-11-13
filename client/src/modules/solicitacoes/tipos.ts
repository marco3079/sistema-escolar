import type { ArquivoDTO } from '../../lib/arquivos';

// Matrícula e rematrícula online (Contrato D). Nomes e formatos vindos da API.

export type TipoSolicitacao = 'NOVA' | 'REMATRICULA';
export type StatusSolicitacao = 'ENVIADA' | 'EM_ANALISE' | 'PENDENTE' | 'APROVADA' | 'RECUSADA';

// Curso dentro de um pedido. O contrato dá o curso com id, nome e nível nos resumos.
// Um texto simples também é aceito por segurança (ver nomeDoCurso).
export type CursoDeSolicitacao = { id: number; nome: string; nivel: string } | string;

export interface SolicitacaoResumoDTO {
  id: number;
  protocolo: string;
  tipo: TipoSolicitacao;
  status: StatusSolicitacao;
  nome: string;
  curso: CursoDeSolicitacao;
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

// GET /solicitacoes (secretaria)
export interface ListaSolicitacoesDTO {
  itens: SolicitacaoResumoDTO[];
  total: number;
  pagina: number;
  porPagina: number;
  contagem: Record<StatusSolicitacao, number>;
}

// Vinculo de responsável devolvido ao aprovar (Contrato A).
export interface ResultadoVinculoDTO {
  vinculoId: number;
  usuarioId: number;
  usuarioCriado: boolean;
  senhaInicial: string | null;
  conviteEnviado: boolean;
}

// POST /solicitacoes/:id/aprovar
export interface AprovacaoDTO {
  solicitacao: SolicitacaoDTO;
  senhaInicial: string | null;
  responsavel: ResultadoVinculoDTO | null;
}

// GET /matricula-online (público) e GET /matricula-online (secretaria)
export interface CursoOfertado {
  id: number;
  nome: string;
  nivel: string;
  regime: string;
  mensalidade: number;
}

export interface PeriodoOfertado {
  id: number;
  nome: string;
}

export interface MatriculaOnlineDTO {
  aberta: boolean;
  texto: string;
  cursos: CursoOfertado[];
  periodos: PeriodoOfertado[];
}

// POST /matricula-online (201)
export interface ComprovanteDTO {
  protocolo: string;
  chave: string;
}

// POST /matricula-online/documentos (201)
export interface DocumentoEnviadoDTO {
  nome: string;
  tamanho: number;
}

// POST /matricula-online/acompanhar
export interface AcompanhamentoDTO {
  protocolo: string;
  tipo: TipoSolicitacao;
  status: StatusSolicitacao;
  nome: string;
  curso: CursoDeSolicitacao;
  criadoEm: string;
  parecer: string;
  documentos: DocumentoEnviadoDTO[];
  podeEnviarDocumentos: boolean;
}

// GET /rematricula/opcoes
export interface OpcaoRematriculaDTO {
  matriculaId: number;
  alunoId: number;
  alunoNome: string;
  curso: CursoDeSolicitacao;
  serieAtual: number;
  status: string; // ATIVA ou TRANCADA
  periodos: { id: number; nome: string }[];
  pedidoAberto: { protocolo: string; status: StatusSolicitacao } | null;
}

// GET /rematricula/minhas
export interface MeuPedidoDTO extends SolicitacaoResumoDTO {
  parecer: string;
}

export const ROTULO_TIPO: Record<TipoSolicitacao, string> = {
  NOVA: 'Matrícula nova',
  REMATRICULA: 'Rematrícula',
};

export const ROTULO_STATUS: Record<StatusSolicitacao, string> = {
  ENVIADA: 'Enviada',
  EM_ANALISE: 'Em análise',
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
};

// Cores dos selos (valores de Selo em ui/index.tsx).
export const COR_STATUS: Record<StatusSolicitacao, 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza'> = {
  ENVIADA: 'cinza',
  EM_ANALISE: 'azul',
  PENDENTE: 'amarelo',
  APROVADA: 'verde',
  RECUSADA: 'vermelho',
};

export const STATUS_EM_ORDEM: StatusSolicitacao[] = ['ENVIADA', 'EM_ANALISE', 'PENDENTE', 'APROVADA', 'RECUSADA'];

export const ROTULO_STATUS_MATRICULA: Record<string, string> = {
  ATIVA: 'Ativa',
  TRANCADA: 'Trancada',
};

// Nome do curso, seja qual for a forma recebida da API.
export function nomeDoCurso(curso: CursoDeSolicitacao): string {
  return typeof curso === 'string' ? curso : curso.nome;
}

// Idade completa em anos numa data AAAA-MM-DD, na data de hoje (horário local). null se inválida.
export function idadeEm(dataIso: string): number | null {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso);
  if (!casamento) return null;
  const ano = Number(casamento[1]);
  const mes = Number(casamento[2]);
  const dia = Number(casamento[3]);
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const mesAtual = hoje.getMonth() + 1;
  if (mesAtual < mes || (mesAtual === mes && hoje.getDate() < dia)) idade -= 1;
  return idade;
}

// Data AAAA-MM-DD não pode estar no futuro (comparação de texto, horário local).
export function dataValidaNaoFutura(dataIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return false;
  const d = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(
    hoje.getDate(),
  ).padStart(2, '0')}`;
  return dataIso <= hojeIso;
}

export const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
