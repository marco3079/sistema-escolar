import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Request } from 'express';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { prisma } from './prisma';
import { HttpError } from './erros';
import { registrarTarefaPeriodica } from './agendador';

// Arquivos das salas de aula (materiais, tarefas e entregas). Contrato A em docs/plano/sexta-leva.md.
// O nome em disco é gerado pelo servidor (32 hexadecimais + extensão); nunca vem do cliente.

export type ContextoArquivo = 'MATERIAL' | 'TAREFA' | 'ENTREGA' | 'SOLICITACAO';
export interface ArquivoDTO { id: number; nome: string; tipo: string; tamanho: number; criadoEm: string }
export const MAX_ARQUIVOS_POR_ITEM = 10;

export const LIMITE_ARQUIVO_BYTES = 20 * 1024 * 1024;
export const MAX_ARQUIVOS_SOLTOS_POR_USUARIO = 30;

const IDADE_SOLTO_MS = 24 * 60 * 60 * 1000;
const IDADE_PARCIAL_MS = 60 * 60 * 1000;
const MINUTOS_LIMPEZA = 60;
const REGEX_CAMINHO_EM_DISCO = /^[0-9a-f]{32}\.[a-z]{2,4}$/;

// Tabela fixa: extensão → tipos MIME aceitos para ela. O tipo enviado tem de estar nesta lista.
export const TIPOS_POR_EXTENSAO: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  odt: ['application/vnd.oasis.opendocument.text'],
  ods: ['application/vnd.oasis.opendocument.spreadsheet'],
  odp: ['application/vnd.oasis.opendocument.presentation'],
  zip: ['application/zip', 'application/x-zip-compressed'],
};

// Só estes tipos abrem no navegador (inline); o resto baixa.
export const TIPOS_DE_IMAGEM_INLINE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function diretorioArquivos(): string {
  return process.env.DIRETORIO_ARQUIVOS ?? '/dados/arquivos';
}

// Apaga um arquivo do disco pelo nome gerado pelo servidor. Falha de disco só é registrada.
export async function apagarDoDisco(caminho: string): Promise<void> {
  if (!REGEX_CAMINHO_EM_DISCO.test(caminho)) return;
  await fs.promises
    .rm(path.join(diretorioArquivos(), caminho), { force: true })
    .catch((erro) => console.error('Não foi possível apagar arquivo:', erro instanceof Error ? erro.message : erro));
}

interface LinhaArquivo {
  id: number;
  nomeOriginal: string;
  tipo: string;
  tamanho: number;
  criadoEm: Date;
}

export function paraDTO(linha: LinhaArquivo): ArquivoDTO {
  return {
    id: linha.id,
    nome: linha.nomeOriginal,
    tipo: linha.tipo,
    tamanho: linha.tamanho,
    criadoEm: linha.criadoEm.toISOString(),
  };
}

// Define o conjunto de arquivos de um item. Os ids que já pertencem a este mesmo item ficam; os novos
// precisam ser arquivos soltos (sem contexto) enviados por `usuarioId` (senão HttpError 400); os que
// pertenciam ao item e não vieram na lista são apagados (linha e disco). Mais de 10: HttpError 400.
export async function definirArquivos(
  usuarioId: number,
  ids: number[],
  contexto: ContextoArquivo,
  contextoId: number
): Promise<void> {
  const desejados = [...new Set(ids)];
  if (desejados.length > MAX_ARQUIVOS_POR_ITEM) {
    throw new HttpError(400, `Cada item aceita até ${MAX_ARQUIVOS_POR_ITEM} arquivos`);
  }

  const atuais = await prisma.arquivo.findMany({
    where: { contexto, contextoId },
    select: { id: true, caminho: true },
  });
  const atuaisIds = new Set(atuais.map((a) => a.id));
  const novos = desejados.filter((id) => !atuaisIds.has(id));
  const removidos = atuais.filter((a) => !desejados.includes(a.id));

  await prisma.$transaction(async (tx) => {
    if (novos.length > 0) {
      // Condições no próprio update: se algo mudou entre a leitura e a gravação, a transação desfaz.
      const { count } = await tx.arquivo.updateMany({
        where: { id: { in: novos }, donoId: usuarioId, contexto: null },
        data: { contexto, contextoId },
      });
      if (count !== novos.length) {
        throw new HttpError(400, 'Arquivo inválido ou não enviado por você');
      }
    }
    if (removidos.length > 0) {
      await tx.arquivo.deleteMany({
        where: { id: { in: removidos.map((a) => a.id) }, contexto, contextoId },
      });
    }
  });

  for (const removido of removidos) {
    await apagarDoDisco(removido.caminho);
  }
}

// Arquivos de vários itens de uma vez (sem consulta por item). Todo id pedido vem no Map, mesmo sem arquivos.
export async function arquivosDe(
  contexto: ContextoArquivo,
  contextoIds: number[]
): Promise<Map<number, ArquivoDTO[]>> {
  const mapa = new Map<number, ArquivoDTO[]>();
  for (const id of contextoIds) {
    mapa.set(id, []);
  }
  if (contextoIds.length === 0) return mapa;

  const linhas = await prisma.arquivo.findMany({
    where: { contexto, contextoId: { in: contextoIds } },
    orderBy: { id: 'asc' },
  });
  for (const linha of linhas) {
    if (linha.contextoId === null) continue;
    const lista = mapa.get(linha.contextoId) ?? [];
    lista.push(paraDTO(linha));
    mapa.set(linha.contextoId, lista);
  }
  return mapa;
}

// Apaga linha e disco de todos os arquivos dos itens (ao excluir material, tarefa ou entrega).
export async function apagarArquivosDe(contexto: ContextoArquivo, contextoIds: number[]): Promise<void> {
  if (contextoIds.length === 0) return;
  const arquivos = await prisma.arquivo.findMany({
    where: { contexto, contextoId: { in: contextoIds } },
    select: { id: true, caminho: true },
  });
  if (arquivos.length === 0) return;

  await prisma.arquivo.deleteMany({ where: { id: { in: arquivos.map((a) => a.id) } } });
  for (const arquivo of arquivos) {
    await apagarDoDisco(arquivo.caminho);
  }
}

// Tarefa periódica: apaga arquivos soltos com mais de 24 horas e arquivos .parcial esquecidos (mais de 1 hora).
async function limparArquivos(): Promise<void> {
  const velhos = await prisma.arquivo.findMany({
    where: { contexto: null, criadoEm: { lt: new Date(Date.now() - IDADE_SOLTO_MS) } },
    select: { id: true, caminho: true },
  });
  if (velhos.length > 0) {
    await prisma.arquivo.deleteMany({ where: { id: { in: velhos.map((v) => v.id) } } });
    for (const velho of velhos) {
      await apagarDoDisco(velho.caminho);
    }
  }

  const dir = diretorioArquivos();
  let nomes: string[];
  try {
    nomes = await fs.promises.readdir(dir);
  } catch {
    return; // pasta ainda não criada (nenhum envio até agora)
  }
  const limiteParcial = Date.now() - IDADE_PARCIAL_MS;
  for (const nome of nomes) {
    if (!nome.endsWith('.parcial')) continue;
    const caminho = path.join(dir, nome);
    try {
      const estado = await fs.promises.stat(caminho);
      if (estado.isFile() && estado.mtimeMs < limiteParcial) {
        await fs.promises.rm(caminho, { force: true });
      }
    } catch {
      // Sumiu ou está em uso: a próxima rodada tenta de novo.
    }
  }
}

// ---------- Envio direto para um item (sétima leva) ----------

export interface OpcoesEnvio {
  donoId: number; // usuário que enviou; 0 = visitante sem login (matrícula online)
  contexto: ContextoArquivo;
  contextoId: number;
  limiteBytes?: number; // padrão LIMITE_ARQUIVO_BYTES
  extensoes?: string[]; // subconjunto de TIPOS_POR_EXTENSAO; padrão todas
}

// Recebe o corpo bruto do pedido como um arquivo já ligado a um item (sem passar por "arquivo solto").
// Cabeçalhos: Content-Type (tipo MIME) e X-Nome-Arquivo (nome com encodeURIComponent).
// Erros: HttpError 400 (nome, extensão ou tipo), 413 (tamanho). Quem chama confere permissão e limites de quantidade.
export async function receberArquivo(req: Request, opcoes: OpcoesEnvio): Promise<ArquivoDTO> {
  const limiteBytes = opcoes.limiteBytes ?? LIMITE_ARQUIVO_BYTES;
  const mensagemLimite = `O arquivo passa do limite de ${Math.round(limiteBytes / (1024 * 1024))} MB`;
  const tipo = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  const codificado = req.headers['x-nome-arquivo'];
  if (typeof codificado !== 'string' || codificado === '') {
    throw new HttpError(400, 'Informe o nome do arquivo em X-Nome-Arquivo');
  }
  let bruto: string;
  try {
    bruto = decodeURIComponent(codificado);
  } catch {
    throw new HttpError(400, 'Nome de arquivo inválido');
  }
  const partes = bruto.split(/[\\/]/);
  const semCaminho = (partes[partes.length - 1] ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  const ponto = semCaminho.lastIndexOf('.');
  if (ponto <= 0 || ponto === semCaminho.length - 1) {
    throw new HttpError(400, 'O arquivo precisa ter uma extensão aceita');
  }
  const extensao = semCaminho.slice(ponto + 1).toLowerCase();
  const aceitas = opcoes.extensoes ?? Object.keys(TIPOS_POR_EXTENSAO);
  if (!Object.prototype.hasOwnProperty.call(TIPOS_POR_EXTENSAO, extensao) || !aceitas.includes(extensao)) {
    throw new HttpError(400, 'Tipo de arquivo não aceito');
  }
  if (!TIPOS_POR_EXTENSAO[extensao].includes(tipo)) {
    throw new HttpError(400, 'O tipo do arquivo não combina com a extensão');
  }
  const base = Array.from(semCaminho.slice(0, ponto)).slice(0, 150 - extensao.length - 1).join('').trim();
  if (base === '') throw new HttpError(400, 'Nome de arquivo inválido');
  const nome = `${base}.${semCaminho.slice(ponto + 1)}`;

  if (Number(req.headers['content-length'] ?? 0) > limiteBytes) {
    throw new HttpError(413, mensagemLimite);
  }

  const dir = diretorioArquivos();
  await fs.promises.mkdir(dir, { recursive: true });
  const caminho = `${crypto.randomBytes(16).toString('hex')}.${extensao}`;
  const destino = path.join(dir, caminho);
  const parcial = destino + '.parcial';

  let recebido = 0;
  const limite = new Transform({
    transform(pedaco: Buffer, _codificacao, callback) {
      recebido += pedaco.length;
      if (recebido > limiteBytes) callback(new HttpError(413, mensagemLimite));
      else callback(null, pedaco);
    },
  });

  let tamanho: number;
  try {
    await pipeline(req, limite, fs.createWriteStream(parcial));
    tamanho = (await fs.promises.stat(parcial)).size;
    if (tamanho === 0) throw new HttpError(400, 'O arquivo está vazio');
    await fs.promises.rename(parcial, destino);
  } catch (erro) {
    await fs.promises.rm(parcial, { force: true }).catch(() => undefined);
    if (erro instanceof HttpError) throw erro;
    console.error('Falha ao gravar arquivo enviado:', erro instanceof Error ? erro.message : erro);
    throw new HttpError(500, 'Não foi possível gravar o arquivo');
  }

  try {
    const criado = await prisma.arquivo.create({
      data: {
        nomeOriginal: nome,
        tipo,
        tamanho,
        caminho,
        donoId: opcoes.donoId,
        contexto: opcoes.contexto,
        contextoId: opcoes.contextoId,
      },
    });
    return paraDTO(criado);
  } catch (erro) {
    await apagarDoDisco(caminho);
    throw erro;
  }
}

registrarTarefaPeriodica('limpeza-arquivos', MINUTOS_LIMPEZA, limparArquivos);
