import { Request, Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam } from '../../lib/erros';
import { acessoTurma } from '../../lib/turmas';
import {
  apagarDoDisco,
  diretorioArquivos,
  LIMITE_ARQUIVO_BYTES,
  MAX_ARQUIVOS_SOLTOS_POR_USUARIO,
  paraDTO,
  TIPOS_DE_IMAGEM_INLINE,
  TIPOS_POR_EXTENSAO,
} from '../../lib/arquivos';

// Arquivos das salas de aula. Contrato A em docs/plano/sexta-leva.md.
// Rotas: POST /arquivos (envio bruto), GET /arquivos/:id (download), DELETE /arquivos/:id (só soltos de quem enviou).

const router = Router();

const MENSAGEM_LIMITE = 'O arquivo passa do limite de 20 MB';
const TAMANHO_MAXIMO_NOME = 150;

// Limpa o nome enviado: sem caminho, sem controle, até 150 caracteres. A extensão precisa estar na tabela.
function nomeEExtensao(codificado: string): { nome: string; extensao: string } {
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
  if (!Object.prototype.hasOwnProperty.call(TIPOS_POR_EXTENSAO, extensao)) {
    throw new HttpError(400, 'Tipo de arquivo não aceito');
  }
  const base = Array.from(semCaminho.slice(0, ponto));
  const maximoBase = TAMANHO_MAXIMO_NOME - extensao.length - 1;
  const nome = `${base.slice(0, maximoBase).join('').trim()}.${semCaminho.slice(ponto + 1)}`;
  if (nome.length <= extensao.length + 1) {
    throw new HttpError(400, 'Nome de arquivo inválido');
  }
  return { nome, extensao };
}

// Cabeçalho Content-Disposition com o nome original (ASCII de reserva + filename* em UTF-8).
function cabecalhoDisposicao(disposicao: 'inline' | 'attachment', nome: string): string {
  const reserva = nome.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(nome).replace(
    /['()*]/g,
    (caractere) => '%' + caractere.charCodeAt(0).toString(16).toUpperCase()
  );
  return `${disposicao}; filename="${reserva}"; filename*=UTF-8''${utf8}`;
}

// Grava o corpo bruto enquanto conta os bytes; passou do limite, para com 413.
async function gravarCorpo(req: Request, destino: string): Promise<void> {
  let recebido = 0;
  const limite = new Transform({
    transform(pedaco: Buffer, _codificacao, callback) {
      recebido += pedaco.length;
      if (recebido > LIMITE_ARQUIVO_BYTES) {
        callback(new HttpError(413, MENSAGEM_LIMITE));
      } else {
        callback(null, pedaco);
      }
    },
  });
  await pipeline(req, limite, fs.createWriteStream(destino));
}

// Acesso à turma sem lançar erro: sem acesso (ou turma inexistente) vira false.
async function temAcessoTurma(req: Request, turmaId: number, somenteEquipe: boolean): Promise<boolean> {
  try {
    const acesso = await acessoTurma(req, turmaId);
    return somenteEquipe ? acesso.papel !== 'ALUNO' : true;
  } catch (erro) {
    if (erro instanceof HttpError) return false;
    throw erro;
  }
}

// Quem pode baixar: arquivo solto, só quem enviou. Ligado: conforme o contexto. Sem acesso: false (vira 404).
async function podeBaixar(
  req: Request,
  arquivo: { donoId: number; contexto: string | null; contextoId: number | null }
): Promise<boolean> {
  if (arquivo.contexto === null || arquivo.contextoId === null) {
    return arquivo.donoId === req.usuario.id;
  }
  if (arquivo.contexto === 'MATERIAL') {
    const material = await prisma.materialAula.findUnique({
      where: { id: arquivo.contextoId },
      select: { turmaId: true },
    });
    return material ? temAcessoTurma(req, material.turmaId, false) : false;
  }
  if (arquivo.contexto === 'TAREFA') {
    const tarefa = await prisma.tarefa.findUnique({
      where: { id: arquivo.contextoId },
      select: { turmaId: true },
    });
    return tarefa ? temAcessoTurma(req, tarefa.turmaId, false) : false;
  }
  if (arquivo.contexto === 'ENTREGA') {
    const entrega = await prisma.tarefaEntrega.findUnique({
      where: { id: arquivo.contextoId },
      select: { inscricaoId: true, tarefa: { select: { turmaId: true } } },
    });
    if (!entrega) return false;
    const inscricao = await prisma.inscricao.findUnique({
      where: { id: entrega.inscricaoId },
      select: { matricula: { select: { aluno: { select: { usuarioId: true } } } } },
    });
    if (inscricao && inscricao.matricula.aluno.usuarioId === req.usuario.id) return true;
    // Professor e gestão da turma (não o aluno da turma).
    return temAcessoTurma(req, entrega.tarefa.turmaId, true);
  }
  if (arquivo.contexto === 'SOLICITACAO') {
    // Documentos de pedidos de matrícula: só a equipe (administrador, TI e secretaria).
    return req.usuario.perfil === 'ADMIN' || req.usuario.perfil === 'SECRETARIA';
  }
  return false;
}

// ---------- Rotas ----------

router.post(
  '/arquivos',
  asyncHandler(async (req, res) => {
    const usuarioId = req.usuario.id;
    const tipo = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    const codificado = req.headers['x-nome-arquivo'];
    if (typeof codificado !== 'string' || codificado === '') {
      throw new HttpError(400, 'Informe o nome do arquivo em X-Nome-Arquivo');
    }
    const { nome, extensao } = nomeEExtensao(codificado);
    if (!TIPOS_POR_EXTENSAO[extensao].includes(tipo)) {
      throw new HttpError(400, 'O tipo do arquivo não combina com a extensão');
    }

    const tamanhoInformado = Number(req.headers['content-length'] ?? 0);
    if (tamanhoInformado > LIMITE_ARQUIVO_BYTES) {
      throw new HttpError(413, MENSAGEM_LIMITE);
    }
    const soltos = await prisma.arquivo.count({ where: { donoId: usuarioId, contexto: null } });
    if (soltos >= MAX_ARQUIVOS_SOLTOS_POR_USUARIO) {
      throw new HttpError(
        400,
        `Você já tem ${MAX_ARQUIVOS_SOLTOS_POR_USUARIO} arquivos enviados sem anexar. Anexe ou remova alguns antes de enviar outro.`
      );
    }

    const dir = diretorioArquivos();
    await fs.promises.mkdir(dir, { recursive: true });
    const caminho = `${crypto.randomBytes(16).toString('hex')}.${extensao}`;
    const destino = path.join(dir, caminho);
    const parcial = destino + '.parcial';

    let tamanho: number;
    try {
      await gravarCorpo(req, parcial);
      tamanho = (await fs.promises.stat(parcial)).size;
      if (tamanho === 0) {
        throw new HttpError(400, 'O arquivo está vazio');
      }
      await fs.promises.rename(parcial, destino);
    } catch (erro) {
      await fs.promises.rm(parcial, { force: true }).catch(() => undefined);
      if (erro instanceof HttpError) throw erro;
      console.error('Falha ao gravar arquivo enviado:', erro instanceof Error ? erro.message : erro);
      throw new HttpError(500, 'Não foi possível gravar o arquivo');
    }

    let criado;
    try {
      criado = await prisma.arquivo.create({
        data: { nomeOriginal: nome, tipo, tamanho, caminho, donoId: usuarioId },
      });
    } catch (erro) {
      await apagarDoDisco(caminho);
      throw erro;
    }
    res.status(201).json(paraDTO(criado));
  })
);

router.get(
  '/arquivos/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const arquivo = await prisma.arquivo.findUnique({ where: { id } });
    if (!arquivo || !(await podeBaixar(req, arquivo))) {
      throw new HttpError(404, 'Arquivo não encontrado');
    }

    const caminho = path.join(diretorioArquivos(), arquivo.caminho);
    let estado: fs.Stats;
    try {
      estado = await fs.promises.stat(caminho);
    } catch {
      throw new HttpError(404, 'Arquivo não encontrado');
    }
    if (!estado.isFile()) throw new HttpError(404, 'Arquivo não encontrado');

    const disposicao = TIPOS_DE_IMAGEM_INLINE.includes(arquivo.tipo) ? 'inline' : 'attachment';
    res.set({
      'Content-Type': arquivo.tipo,
      'Content-Length': String(estado.size),
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': cabecalhoDisposicao(disposicao, arquivo.nomeOriginal),
      'Cache-Control': 'private, no-store',
    });
    try {
      await pipeline(fs.createReadStream(caminho), res);
    } catch (erro) {
      if (!res.headersSent) throw erro;
      console.error('Falha ao enviar arquivo:', erro instanceof Error ? erro.message : erro);
      res.destroy();
    }
  })
);

router.delete(
  '/arquivos/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const arquivo = await prisma.arquivo.findUnique({ where: { id }, select: { caminho: true } });
    if (!arquivo) throw new HttpError(404, 'Arquivo não encontrado');
    // Só arquivo solto e só de quem enviou; a condição vai no próprio delete.
    const { count } = await prisma.arquivo.deleteMany({
      where: { id, contexto: null, donoId: req.usuario.id },
    });
    if (count === 0) throw new HttpError(404, 'Arquivo não encontrado');
    await apagarDoDisco(arquivo.caminho);
    res.status(204).end();
  })
);

export default router;
