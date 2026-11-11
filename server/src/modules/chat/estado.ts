// Estado do chat que fica só na memória do servidor: presença, quem está digitando
// e o limite de envio por pessoa. Nada disso vai para o banco.

// Visto há menos de 20 s conta como online.
export const JANELA_ONLINE_MS = 20_000;
const DURACAO_DIGITANDO_MS = 5_000;
const JANELA_ENVIOS_MS = 60_000;
export const LIMITE_ENVIOS_POR_MINUTO = 30;
// Presença guardada por 2 min (mais que a janela de online, para detectar mudanças em `desde`).
const RETENCAO_PRESENCA_MS = 120_000;
const INTERVALO_LIMPEZA_MS = 60_000;

// usuarioId -> último instante em que a pessoa sincronizou ou consultou as não lidas
const presenca = new Map<number, number>();
// conversaId -> (usuarioId -> até quando está digitando)
const digitandoPorConversa = new Map<number, Map<number, number>>();
// usuarioId -> janela atual de envios
const janelasDeEnvio = new Map<number, { inicio: number; quantidade: number }>();

export function marcarPresenca(usuarioId: number, agora: number = Date.now()): void {
  presenca.set(usuarioId, agora);
}

// Último instante visto (ms) ou undefined.
export function ultimoVisto(usuarioId: number): number | undefined {
  return presenca.get(usuarioId);
}

export function estaOnline(usuarioId: number, agora: number = Date.now()): boolean {
  const visto = presenca.get(usuarioId);
  return visto !== undefined && agora - visto < JANELA_ONLINE_MS;
}

export function marcarDigitando(conversaId: number, usuarioId: number, agora: number = Date.now()): void {
  let mapa = digitandoPorConversa.get(conversaId);
  if (!mapa) {
    mapa = new Map<number, number>();
    digitandoPorConversa.set(conversaId, mapa);
  }
  mapa.set(usuarioId, agora + DURACAO_DIGITANDO_MS);
}

// Quem acabou de enviar a mensagem deixa de aparecer como digitando.
export function pararDeDigitar(conversaId: number, usuarioId: number): void {
  digitandoPorConversa.get(conversaId)?.delete(usuarioId);
}

// Ids de quem está digitando na conversa, sem o `excluirId`.
export function quemDigita(conversaId: number, excluirId: number, agora: number = Date.now()): number[] {
  const mapa = digitandoPorConversa.get(conversaId);
  if (!mapa) {
    return [];
  }
  const ids: number[] = [];
  for (const [usuarioId, ate] of mapa) {
    if (ate <= agora) {
      mapa.delete(usuarioId);
      continue;
    }
    if (usuarioId !== excluirId) {
      ids.push(usuarioId);
    }
  }
  if (mapa.size === 0) {
    digitandoPorConversa.delete(conversaId);
  }
  return ids;
}

// false quando a pessoa já enviou LIMITE_ENVIOS_POR_MINUTO mensagens na janela atual.
export function permitirEnvio(usuarioId: number, agora: number = Date.now()): boolean {
  const janela = janelasDeEnvio.get(usuarioId);
  if (!janela || agora - janela.inicio >= JANELA_ENVIOS_MS) {
    janelasDeEnvio.set(usuarioId, { inicio: agora, quantidade: 1 });
    return true;
  }
  if (janela.quantidade >= LIMITE_ENVIOS_POR_MINUTO) {
    return false;
  }
  janela.quantidade += 1;
  return true;
}

function limpar(): void {
  const agora = Date.now();
  for (const [usuarioId, visto] of presenca) {
    if (agora - visto >= RETENCAO_PRESENCA_MS) {
      presenca.delete(usuarioId);
    }
  }
  for (const [usuarioId, janela] of janelasDeEnvio) {
    if (agora - janela.inicio >= JANELA_ENVIOS_MS) {
      janelasDeEnvio.delete(usuarioId);
    }
  }
  for (const [conversaId, mapa] of digitandoPorConversa) {
    for (const [usuarioId, ate] of mapa) {
      if (ate <= agora) {
        mapa.delete(usuarioId);
      }
    }
    if (mapa.size === 0) {
      digitandoPorConversa.delete(conversaId);
    }
  }
}

const temporizadorLimpeza = setInterval(limpar, INTERVALO_LIMPEZA_MS);
temporizadorLimpeza.unref();
