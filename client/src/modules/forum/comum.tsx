import { useAuth } from '../../lib/auth';
import type { Perfil } from '../../lib/tipos';
import { Selo, formatarData } from '../../ui';

// ---------- Tipos (formato do docs/plano/terceira-leva.md, seção Fórum) ----------

export type Voto = 1 | -1 | 0;

export interface UsuarioResumo {
  id: number;
  nome: string;
  perfil: string;
  foto: string | null;
}

export interface ComunidadeDTO {
  id: number;
  nome: string;
  slug: string;
  descricao: string | null;
  cor: string;
  publicacoes: number;
  criadoEm: string;
}

export interface PublicacaoDTO {
  id: number;
  titulo: string;
  corpo: string;
  imagem: string | null;
  fixada: boolean;
  fechada: boolean;
  pontos: number;
  comentarios: number;
  meuVoto: Voto;
  criadoEm: string;
  editadoEm: string | null;
  autor: UsuarioResumo;
  comunidade: { nome: string; slug: string; cor: string };
  posso: { editar: boolean; excluir: boolean; moderar: boolean };
}

export interface ComentarioDTO {
  id: number;
  paiId: number | null;
  corpo: string;
  removido: boolean;
  pontos: number;
  meuVoto: Voto;
  criadoEm: string;
  editadoEm: string | null;
  autor: UsuarioResumo;
  posso: { editar: boolean; excluir: boolean };
}

export interface PublicacaoDetalhe extends PublicacaoDTO {
  comentariosLista: ComentarioDTO[];
}

export interface ListaPublicacoes {
  itens: PublicacaoDTO[];
  haMais: boolean;
}

export type Ordem = 'alta' | 'novas' | 'votadas';

export const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Em alta' },
  { valor: 'novas', rotulo: 'Novas' },
  { valor: 'votadas', rotulo: 'Mais votadas' },
];

export const TAMANHO_PAGINA = 20;

// ---------- Portal e papéis ----------

// Prefixo das rotas do fórum conforme o portal do usuário.
export function baseForum(perfil: Perfil | undefined): string {
  if (perfil === 'PROFESSOR') return '/professor';
  if (perfil === 'ALUNO') return '/aluno';
  return '/admin';
}

// Base do portal do usuário logado (usada em todos os links do fórum).
export function useBase(): string {
  const { usuario } = useAuth();
  return baseForum(usuario?.perfil);
}

// Equipe: quem administra o sistema (ADMIN, SECRETARIA e TI).
export function ehEquipe(perfil: string): boolean {
  return perfil === 'ADMIN' || perfil === 'SECRETARIA' || perfil === 'TI';
}

// Quem pode criar comunidades (ADMIN, SECRETARIA e PROFESSOR).
export function podeCriarComunidade(perfil: Perfil | undefined): boolean {
  return perfil === 'ADMIN' || perfil === 'SECRETARIA' || perfil === 'PROFESSOR';
}

export function SeloPapel({ perfil }: { perfil: string }) {
  if (perfil === 'PROFESSOR') return <Selo cor="azul">Professor</Selo>;
  if (ehEquipe(perfil)) return <Selo cor="verde">Equipe</Selo>;
  return null;
}

// ---------- Cores das comunidades (classes, sem cor fixa no CSS) ----------

export const CORES_COMUNIDADE = ['azul', 'roxo', 'verde', 'laranja'] as const;

export function classeCor(cor: string): string {
  return (CORES_COMUNIDADE as readonly string[]).includes(cor) ? cor : 'azul';
}

// ---------- Formatação ----------

// Pontos compactos: 999, "1 mil", "1,2 mil".
export function formatarPontos(n: number): string {
  const sinal = n < 0 ? '-' : '';
  const absoluto = Math.abs(n);
  if (absoluto < 1000) return `${sinal}${absoluto}`;
  const mil = Math.round(absoluto / 100) / 10;
  return `${sinal}${mil.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
}

export function tempoRelativo(iso: string, agora: number = Date.now()): string {
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) return '';
  const minutos = Math.floor((agora - instante) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `há ${dias} d`;
  return formatarData(iso);
}

export function contarComentarios(n: number): string {
  return n === 1 ? '1 comentário' : `${n} comentários`;
}

export function contarPublicacoes(n: number): string {
  return n === 1 ? '1 publicação' : `${n} publicações`;
}

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Monta a query string ignorando valores vazios.
export function montarQuery(parametros: Record<string, string | number | undefined>): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === '') continue;
    busca.set(chave, String(valor));
  }
  return busca.toString();
}
