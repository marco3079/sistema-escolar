// Tipos do Contrato C (API do chat, prefixo /chat) e auxiliares da tela do chat.

export type PerfilChat = 'ADMIN' | 'TI' | 'SECRETARIA' | 'PROFESSOR' | 'ALUNO' | 'RESPONSAVEL';

export interface PessoaChat {
  id: number;
  nome: string;
  perfil: PerfilChat;
  foto: string | null;
  online: boolean;
}

export type EstadoMensagem = 'ENVIADA' | 'ENTREGUE' | 'LIDA';

export interface CitacaoChat {
  id: number;
  autorNome: string;
  texto: string;
  temImagem: boolean;
  apagada: boolean;
}

export interface MensagemChat {
  id: number;
  conversaId: number;
  autor: { id: number; nome: string; foto: string | null };
  texto: string; // "" quando apagada
  imagem: string | null; // null quando apagada
  apagada: boolean;
  sistema: boolean;
  respostaA: CitacaoChat | null;
  criadaEm: string;
  minha: boolean;
  estado: EstadoMensagem | null; // só nas minhas
}

export interface UltimaMensagemChat {
  texto: string;
  autorNome: string;
  minha: boolean;
  temImagem: boolean;
  apagada: boolean;
  criadaEm: string;
  estado: EstadoMensagem | null;
}

export interface ConversaChat {
  id: number;
  tipo: 'INDIVIDUAL' | 'GRUPO';
  nome: string;
  foto: string | null;
  outro: PessoaChat | null;
  participantes: number;
  souAdmin: boolean;
  ultima: UltimaMensagemChat | null;
  naoLidas: number;
  digitando: string[];
  atualizadaEm: string;
}

export interface MembroChat extends PessoaChat {
  admin: boolean;
}

export interface ConversaDetalhe extends ConversaChat {
  membros: MembroChat[];
}

export interface LeituraChat {
  entregueAte: string | null;
  lidaAte: string | null;
}

export interface AbertaSincronizacao {
  mensagens: MensagemChat[];
  digitando: string[];
  leitura: LeituraChat;
  online: boolean | null;
}

export interface Sincronizacao {
  agora: string;
  naoLidasTotal: number;
  conversas: ConversaChat[];
  aberta: AbertaSincronizacao | null;
}

export interface PaginaMensagensChat {
  itens: MensagemChat[];
  haMais: boolean;
}

// Mensagem na tela: as confirmadas pelo servidor ou um envio ainda não confirmado (id negativo).
export interface EnvioPendente {
  status: 'enviando' | 'falhou';
  texto: string;
  imagem: string | null;
  respostaAId: number | null;
  erro?: string;
}

export interface MensagemTela extends MensagemChat {
  pendente?: EnvioPendente;
}

// Constantes
export const PAGINA_MENSAGENS = 30;
export const LIMITE_IMAGEM_CHAT = 200000;
export const LIMITE_TEXTO_MENSAGEM = 4000;
export const LIMITE_GRUPO_PARTICIPANTES = 99;

// ---------- Erros ----------

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// ---------- Datas ----------

function dataValida(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Hora curta (HH:MM) de uma mensagem.
export function horaDaMensagem(iso: string): string {
  const d = dataValida(iso);
  if (!d) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Chave do dia local (usada para separar mensagens por dia).
export function chaveDoDia(iso: string): string {
  const d = dataValida(iso);
  if (!d) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Rótulo do separador de dia: "Hoje", "Ontem" ou a data.
export function rotuloDoDia(iso: string, agora: Date = new Date()): string {
  const d = dataValida(iso);
  if (!d) return '';
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diferenca = Math.round((hoje.getTime() - dia.getTime()) / 86400000);
  if (diferenca === 0) return 'Hoje';
  if (diferenca === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Hora da lista: hoje mostra a hora; ontem mostra "Ontem"; antes mostra a data curta.
export function horaDaLista(iso: string, agora: Date = new Date()): string {
  const d = dataValida(iso);
  if (!d) return '';
  const diferenca = Math.round(
    (new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  );
  if (diferenca <= 0) return horaDaMensagem(iso);
  if (diferenca === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ---------- Estado (tiques) ----------

// Estado de uma mensagem minha, recalculado com a leitura dos outros participantes.
// Sem leitura conhecida, vale o estado que veio do servidor.
export function estadoDaMensagem(m: MensagemTela, leitura: LeituraChat | null): EstadoMensagem {
  if (m.pendente) return 'ENVIADA';
  if (leitura) {
    const momento = dataValida(m.criadaEm)?.getTime() ?? 0;
    const lida = leitura.lidaAte ? Date.parse(leitura.lidaAte) : NaN;
    const entregue = leitura.entregueAte ? Date.parse(leitura.entregueAte) : NaN;
    if (!Number.isNaN(lida) && momento <= lida) return 'LIDA';
    if (!Number.isNaN(entregue) && momento <= entregue) return 'ENTREGUE';
    return 'ENVIADA';
  }
  return m.estado ?? 'ENVIADA';
}

// ---------- Listas ----------

function tempoDe(iso: string): number {
  return dataValida(iso)?.getTime() ?? 0;
}

// Ordena por data de criação e, em empate, por id.
export function ordenarMensagens(lista: MensagemTela[]): MensagemTela[] {
  return [...lista].sort((a, b) => tempoDe(a.criadaEm) - tempoDe(b.criadaEm) || a.id - b.id);
}

// Junta mensagens novas à lista atual, trocando as que têm o mesmo id (ex.: apagadas depois).
export function mesclarMensagens(atual: MensagemTela[], novas: MensagemTela[]): MensagemTela[] {
  if (novas.length === 0) return atual;
  const porId = new Map<number, MensagemTela>();
  for (const m of atual) porId.set(m.id, m);
  for (const m of novas) porId.set(m.id, m);
  return ordenarMensagens([...porId.values()]);
}

// Aplica mensagens vindas do servidor (sincronizar ou páginas). Uma mensagem minha confirmada troca a
// otimista pendente com o mesmo texto e imagem (mesmo que chegue antes da resposta do POST); depois,
// tudo entra substituindo pelo id, sem duplicar.
export function mesclarRecebidas(atual: MensagemTela[], novas: MensagemTela[]): MensagemTela[] {
  let lista = atual;
  for (const n of novas) {
    if (!n.minha || n.id <= 0) continue;
    // Mensagem já confirmada que o sincronizar reenvia (folga de 2 s) não troca nenhuma pendente.
    if (lista.some((m) => m.id === n.id)) continue;
    const indice = lista.findIndex(
      (m) =>
        m.id < 0 &&
        m.pendente !== undefined &&
        m.conversaId === n.conversaId &&
        m.texto === n.texto &&
        (m.imagem ?? null) === (n.imagem ?? null),
    );
    if (indice >= 0) lista = lista.filter((_, i) => i !== indice);
  }
  return mesclarMensagens(lista, novas);
}

// Atualiza as conversas da lista: troca as que chegaram e ordena da mais recente para a mais antiga.
export function mesclarConversas(atual: ConversaChat[], novas: ConversaChat[]): ConversaChat[] {
  const porId = new Map<number, ConversaChat>();
  for (const c of atual) porId.set(c.id, c);
  for (const c of novas) porId.set(c.id, c);
  return [...porId.values()].sort((a, b) => tempoDe(b.atualizadaEm) - tempoDe(a.atualizadaEm));
}

// Corta um texto em N caracteres completos (não parte emoji ao meio).
export function cortarTexto(texto: string, quantidade: number): string {
  return Array.from(texto).slice(0, quantidade).join('');
}

// Citação de uma mensagem (usada ao responder), com o texto cortado em 120 caracteres.
export function citacaoDe(m: MensagemTela): CitacaoChat {
  return {
    id: m.id,
    autorNome: m.autor.nome,
    texto: m.apagada ? '' : cortarTexto(m.texto, 120),
    temImagem: m.imagem !== null,
    apagada: m.apagada,
  };
}

// Prévia da última mensagem na lista.
export function previaDaUltima(ultima: UltimaMensagemChat): string {
  if (ultima.apagada) return 'Mensagem apagada';
  if (ultima.texto.trim() === '' && ultima.temImagem) return 'Foto';
  return ultima.texto;
}

// Primeiro nome para "digitando..." e para o cabeçalho.
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

// Campo de texto em toque: Enter quebra linha e o botão envia.
export function ehDispositivoDeToque(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

// ---------- Imagens ----------

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

// Pares (fator do lado, qualidade JPEG) tentados em ordem até caber no limite.
const TENTATIVAS_IMAGEM: { fator: number; qualidade: number }[] = [
  { fator: 1, qualidade: 0.85 },
  { fator: 1, qualidade: 0.7 },
  { fator: 1, qualidade: 0.55 },
  { fator: 0.8, qualidade: 0.55 },
  { fator: 0.6, qualidade: 0.5 },
  { fator: 0.45, qualidade: 0.45 },
];

// Reduz uma imagem no navegador: maior lado até `ladoMaximo`, JPEG, abaixo de 200.000 caracteres.
// Devolve a data URL. Lança Error com mensagem para o usuário se nada couber.
export async function reduzirImagemChat(arquivo: File, ladoMaximo = 1280): Promise<string> {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem (PNG, JPEG ou WebP).');
  }
  const img = await carregarImagem(arquivo);
  const maiorLado = Math.max(img.naturalWidth, img.naturalHeight);
  if (maiorLado <= 0) throw new Error('Não foi possível ler a imagem.');

  for (const t of TENTATIVAS_IMAGEM) {
    const lado = Math.max(1, Math.round(ladoMaximo * t.fator));
    const escala = Math.min(1, lado / maiorLado);
    const largura = Math.max(1, Math.round(img.naturalWidth * escala));
    const altura = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a imagem.');
    // Fundo branco: imagens com transparência continuam legíveis em JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(img, 0, 0, largura, altura);
    const dataUrl = canvas.toDataURL('image/jpeg', t.qualidade);
    if (dataUrl.length <= LIMITE_IMAGEM_CHAT) return dataUrl;
  }
  throw new Error('A imagem é grande demais, mesmo reduzida. Escolha outra.');
}
