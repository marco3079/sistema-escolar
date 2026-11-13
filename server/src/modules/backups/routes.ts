import { Request, Router } from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawn, type ChildProcess } from 'child_process';
import { pipeline, Readable, Transform, Writable } from 'stream';
import { pipeline as pipelinePromessa } from 'stream/promises';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { registrarLog, type TipoLog } from '../../lib/log';
import { lerConfiguracao, limparCacheConfiguracao } from '../../lib/email';
import { registrarTarefaDiaria } from '../../lib/agendador';

// Cópia de segurança do banco (só ADMIN). Contrato C em docs/plano/quinta-leva.md.
// Usa pg_dump e psql 16 com spawn e argumentos em lista; a senha vai só na variável PGPASSWORD do processo filho.

const router = Router();

const REGEX_NOME = /^escola-\d{8}-\d{6}-(auto|manual|enviado|pre-restauracao)\.sql\.gz$/;
const REGEX_VERSAO_16 = /^pg_dump \(PostgreSQL\) 16[.\s]/;
const LIMITE_COPIAS = 40;
const LIMITE_ENVIO_BYTES = 200 * 1024 * 1024;
const MENSAGEM_LIMITE_ENVIO = 'O arquivo passa do limite de 200 MB';
const MENSAGEM_OCUPADO = 'Já existe uma cópia de segurança ou restauração em andamento. Aguarde terminar.';
const MENSAGEM_FALHA_COPIA =
  'Não foi possível criar a cópia de segurança. Confira se o PostgreSQL 16 (pg_dump) está instalado no servidor.';
const PALAVRA_CONFIRMACAO = 'RESTAURAR';

type Origem = 'auto' | 'manual' | 'enviado' | 'pre-restauracao';
type Operacao = 'copia' | 'restauracao';

interface BackupDTO {
  nome: string;
  tamanho: number;
  criadoEm: string;
  origem: Origem;
}

interface ConfigBackupDTO {
  backupAutomatico: boolean;
  backupHora: number;
  backupManter: number;
  ultimoAutomatico: string | null;
  ferramentasOk: boolean;
}

interface Conexao {
  host: string;
  porta: string;
  usuario: string;
  senha: string;
  banco: string;
}

// Trava em memória: só uma cópia ou restauração por vez.
let emAndamento: Operacao | null = null;

const configuracaoSchema = z.object({
  backupAutomatico: z.boolean(),
  backupHora: z
    .number()
    .int('A hora vai de 0 a 23')
    .min(0, 'A hora vai de 0 a 23')
    .max(23, 'A hora vai de 0 a 23'),
  backupManter: z
    .number()
    .int('Guarde de 1 a 60 cópias')
    .min(1, 'Guarde de 1 a 60 cópias')
    .max(60, 'Guarde de 1 a 60 cópias'),
});

// ---------- Funções auxiliares ----------

function diretorio(): string {
  return process.env.DIRETORIO_BACKUPS ?? '/dados/backups';
}

function caminhoDe(nome: string): string {
  return path.join(diretorio(), nome);
}

// Só nomes no formato do contrato chegam ao disco.
function nomeValido(valor: unknown): string {
  if (typeof valor !== 'string' || !REGEX_NOME.test(valor)) {
    throw new HttpError(400, 'Nome de cópia inválido');
  }
  return valor;
}

function nomeDaCopia(origem: Origem, agora: Date): string {
  const dois = (numero: number): string => String(numero).padStart(2, '0');
  const data = `${agora.getFullYear()}${dois(agora.getMonth() + 1)}${dois(agora.getDate())}`;
  const hora = `${dois(agora.getHours())}${dois(agora.getMinutes())}${dois(agora.getSeconds())}`;
  return `escola-${data}-${hora}-${origem}.sql.gz`;
}

// Lê a conexão de DATABASE_URL. Nunca inclui o conteúdo da URL nas mensagens de erro.
function lerConexao(): Conexao {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    const banco = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!url.hostname || !url.username || banco === '') {
      throw new Error('DATABASE_URL incompleta');
    }
    return {
      host: url.hostname,
      porta: url.port || '5432',
      usuario: decodeURIComponent(url.username),
      senha: decodeURIComponent(url.password),
      banco,
    };
  } catch {
    throw new Error('DATABASE_URL inválida');
  }
}

function argumentosDeConexao(conexao: Conexao): string[] {
  return ['--host', conexao.host, '--port', conexao.porta, '--username', conexao.usuario, '--dbname', conexao.banco];
}

// Ambiente mínimo do processo filho: a senha vai só aqui (nunca em argumento).
function ambienteDaFerramenta(conexao: Conexao): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH ?? '', LANG: 'C.UTF-8', PGPASSWORD: conexao.senha };
}

// Remove a senha de qualquer texto antes de ir para o console.
function segredosDoBanco(): string[] {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return [url.password, decodeURIComponent(url.password)].filter((segredo) => segredo !== '');
  } catch {
    return [];
  }
}

function mensagemSegura(erro: unknown): string {
  let texto = erro instanceof Error ? erro.message : String(erro);
  for (const segredo of segredosDoBanco()) {
    texto = texto.split(segredo).join('***');
  }
  return texto.slice(0, 500);
}

// Roda uma ferramenta do PostgreSQL com argumentos em lista. Entrada e saída opcionais em stream.
function rodarFerramenta(
  comando: string,
  argumentos: string[],
  conexao: Conexao,
  io: { entrada?: Readable; saida?: Writable }
): Promise<void> {
  return new Promise<void>((resolver, rejeitar) => {
    const filho = spawn(comando, argumentos, {
      env: ambienteDaFerramenta(conexao),
      stdio: [io.entrada ? 'pipe' : 'ignore', io.saida ? 'pipe' : 'ignore', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    let erros = '';
    filho.stderr?.on('data', (pedaco: Buffer) => {
      erros = (erros + pedaco.toString('utf8')).slice(-1000);
    });

    const tarefas: Promise<void>[] = [
      new Promise<void>((ok, nok) => {
        filho.on('error', nok);
        filho.on('close', (codigo) => {
          if (codigo === 0) {
            ok();
          } else {
            nok(new Error(`${comando} terminou com código ${codigo}. ${erros}`));
          }
        });
      }),
    ];

    if (io.entrada && filho.stdin) {
      const entrada = io.entrada;
      const stdin = filho.stdin;
      tarefas.push(new Promise<void>((ok, nok) => pipeline(entrada, stdin, (erro) => (erro ? nok(erro) : ok()))));
    }
    if (io.saida && filho.stdout) {
      const stdout = filho.stdout;
      const saida = io.saida;
      tarefas.push(new Promise<void>((ok, nok) => pipeline(stdout, saida, (erro) => (erro ? nok(erro) : ok()))));
    }

    // Qualquer falha mata o processo filho antes de esperar as outras partes.
    const envolvidas = tarefas.map((tarefa) =>
      tarefa.catch((erro: unknown) => {
        filho.kill();
        throw erro;
      })
    );
    Promise.allSettled(envolvidas).then((resultados) => {
      const falha = resultados.find((resultado) => resultado.status === 'rejected');
      if (falha && falha.status === 'rejected') {
        rejeitar(falha.reason instanceof Error ? falha.reason : new Error('Falha na ferramenta de banco'));
      } else {
        resolver();
      }
    });
  });
}

// Confere se pg_dump responde e é da versão 16.
function versaoPgDumpOk(): Promise<boolean> {
  return new Promise<boolean>((resolver) => {
    let saida = '';
    let filho: ChildProcess;
    try {
      filho = spawn('pg_dump', ['--version'], {
        env: { PATH: process.env.PATH ?? '', LANG: 'C.UTF-8' },
        stdio: ['ignore', 'pipe', 'ignore'],
        shell: false,
        windowsHide: true,
      });
    } catch {
      resolver(false);
      return;
    }
    const tempo = setTimeout(() => filho.kill(), 10_000);
    filho.stdout?.on('data', (pedaco: Buffer) => {
      saida += pedaco.toString('utf8');
    });
    filho.on('error', () => {
      clearTimeout(tempo);
      resolver(false);
    });
    filho.on('close', (codigo) => {
      clearTimeout(tempo);
      resolver(codigo === 0 && REGEX_VERSAO_16.test(saida));
    });
  });
}

async function dtoDe(nome: string): Promise<BackupDTO | null> {
  const correspondencia = REGEX_NOME.exec(nome);
  if (!correspondencia) return null;
  try {
    const estado = await fs.promises.stat(caminhoDe(nome));
    if (!estado.isFile()) return null;
    return {
      nome,
      tamanho: estado.size,
      criadoEm: estado.mtime.toISOString(),
      origem: correspondencia[1] as Origem,
    };
  } catch {
    return null;
  }
}

// Mais novo primeiro (o nome começa pela data e hora).
async function listarCopias(): Promise<BackupDTO[]> {
  await fs.promises.mkdir(diretorio(), { recursive: true });
  const nomes = (await fs.promises.readdir(diretorio()))
    .filter((nome) => REGEX_NOME.test(nome))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const itens = await Promise.all(nomes.map((nome) => dtoDe(nome)));
  return itens.filter((item): item is BackupDTO => item !== null);
}

async function montarConfig(itens: BackupDTO[]): Promise<ConfigBackupDTO> {
  const configuracao = await lerConfiguracao();
  const ultimo = itens.find((item) => item.origem === 'auto');
  return {
    backupAutomatico: configuracao.backupAutomatico,
    backupHora: configuracao.backupHora,
    backupManter: configuracao.backupManter,
    ultimoAutomatico: ultimo ? ultimo.criadoEm : null,
    ferramentasOk: await versaoPgDumpOk(),
  };
}

async function garantirEspaco(): Promise<void> {
  const itens = await listarCopias();
  if (itens.length >= LIMITE_COPIAS) {
    throw new HttpError(
      400,
      `Já há ${LIMITE_COPIAS} cópias guardadas. Apague as antigas antes de criar ou enviar outra.`
    );
  }
}

// Só deve ser chamada com a trava já tomada pelo chamador.
async function criarCopia(origem: Origem): Promise<BackupDTO> {
  await fs.promises.mkdir(diretorio(), { recursive: true });
  const nome = nomeDaCopia(origem, new Date());
  const destino = caminhoDe(nome);
  const parcial = destino + '.parcial';
  if (fs.existsSync(destino)) {
    throw new HttpError(409, 'Já existe uma cópia com este horário. Tente de novo em alguns segundos.');
  }

  try {
    const conexao = lerConexao();
    const compactado = zlib.createGzip();
    const arquivo = fs.createWriteStream(parcial);
    const gravacao = new Promise<void>((ok, nok) =>
      pipeline(compactado, arquivo, (erro) => (erro ? nok(erro) : ok()))
    );
    const dump = rodarFerramenta(
      'pg_dump',
      ['--no-owner', '--no-privileges', '--clean', '--if-exists', ...argumentosDeConexao(conexao)],
      conexao,
      { saida: compactado }
    );
    const resultados = await Promise.allSettled([dump, gravacao]);
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') throw resultado.reason;
    }
    await fs.promises.rename(parcial, destino);
    const copia = await dtoDe(nome);
    if (!copia) throw new Error('cópia criada não encontrada');
    return copia;
  } catch (erro) {
    await fs.promises.rm(parcial, { force: true }).catch(() => undefined);
    console.error('Falha ao criar cópia de segurança:', mensagemSegura(erro));
    throw new HttpError(500, MENSAGEM_FALHA_COPIA);
  }
}

// Restaura numa única transação: se algo falhar, o psql desfaz tudo (ON_ERROR_STOP + single-transaction).
async function restaurarCopia(nome: string): Promise<void> {
  const conexao = lerConexao();
  const origem = fs.createReadStream(caminhoDe(nome));
  const descompactado = origem.pipe(zlib.createGunzip());
  origem.on('error', (erro) => descompactado.destroy(erro));
  descompactado.on('close', () => origem.destroy());
  await rodarFerramenta(
    'psql',
    ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', ...argumentosDeConexao(conexao)],
    conexao,
    { entrada: descompactado }
  );
}

// Trava: uma operação de cada vez. Checagem e marcação são síncronas (sem espaço para corrida).
async function comTrava<T>(operacao: Operacao, tarefa: () => Promise<T>): Promise<T> {
  if (emAndamento !== null) {
    throw new HttpError(409, MENSAGEM_OCUPADO);
  }
  emAndamento = operacao;
  try {
    return await tarefa();
  } finally {
    emAndamento = null;
  }
}

async function apagarAutomaticasExcedentes(manter: number): Promise<void> {
  const automaticas = (await listarCopias()).filter((item) => item.origem === 'auto');
  for (const excedente of automaticas.slice(manter)) {
    try {
      await fs.promises.unlink(caminhoDe(excedente.nome));
    } catch (erro) {
      console.error('Falha ao apagar cópia automática antiga:', mensagemSegura(erro));
    }
  }
}

// Tarefa diária: a hora vem da configuração a cada verificação; null desliga.
async function copiaAutomatica(): Promise<void> {
  if (emAndamento !== null) {
    console.warn('Cópia automática adiada: já há uma cópia ou restauração em andamento.');
    return;
  }
  await comTrava('copia', async () => {
    await criarCopia('auto');
    const configuracao = await lerConfiguracao();
    await apagarAutomaticasExcedentes(configuracao.backupManter);
  });
}

registrarTarefaDiaria(
  'backup',
  async () => {
    const configuracao = await lerConfiguracao();
    return configuracao.backupAutomatico ? configuracao.backupHora : null;
  },
  copiaAutomatica
);

// Registro manual de atividade (estas rotas ficam fora do registro automático).
function registrar(req: Request, tipo: TipoLog, descricao: string, status: number): void {
  registrarLog({
    usuarioId: req.usuario.id,
    perfil: req.usuario.perfilReal ?? req.usuario.perfil,
    tipo,
    modulo: 'backups',
    descricao,
    metodo: req.method,
    caminho: req.originalUrl.split('?')[0],
    status,
    ip: req.ip ?? null,
    navegador: req.get('user-agent')?.slice(0, 200) ?? null,
  });
}

// Grava o corpo bruto enquanto conta os bytes; passou do limite, para com 413.
async function gravarEnvio(req: Request, destino: string): Promise<void> {
  let recebido = 0;
  const limite = new Transform({
    transform(pedaco: Buffer, _codificacao, callback) {
      recebido += pedaco.length;
      if (recebido > LIMITE_ENVIO_BYTES) {
        callback(new HttpError(413, MENSAGEM_LIMITE_ENVIO));
      } else {
        callback(null, pedaco);
      }
    },
  });
  await pipelinePromessa(req, limite, fs.createWriteStream(destino));
}

// Confere a assinatura gzip (1f 8b).
async function conferirGzip(caminho: string): Promise<void> {
  const arquivo = await fs.promises.open(caminho, 'r');
  try {
    const inicio = Buffer.alloc(2);
    const { bytesRead } = await arquivo.read(inicio, 0, 2, 0);
    if (bytesRead < 2 || inicio[0] !== 0x1f || inicio[1] !== 0x8b) {
      throw new HttpError(400, 'O arquivo não é uma cópia de segurança válida (.sql.gz)');
    }
  } finally {
    await arquivo.close();
  }
}

// ---------- Rotas (ADMIN) ----------

router.get(
  '/backups',
  permitir('ADMIN'),
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const itens = await listarCopias();
    res.json({ config: await montarConfig(itens), itens, emAndamento });
  })
);

router.put(
  '/backups/configuracao',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const dados = validar(configuracaoSchema, req.body);
    await lerConfiguracao();
    await prisma.configuracaoPlataforma.update({
      where: { id: 1 },
      data: {
        backupAutomatico: dados.backupAutomatico,
        backupHora: dados.backupHora,
        backupManter: dados.backupManter,
      },
    });
    limparCacheConfiguracao();
    res.json(await montarConfig(await listarCopias()));
  })
);

router.post(
  '/backups',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const copia = await comTrava('copia', async () => {
      await garantirEspaco();
      return criarCopia('manual');
    });
    registrar(req, 'CRIACAO', 'Criou uma cópia de segurança', 201);
    res.status(201).json(copia);
  })
);

// Recebe o arquivo bruto (Content-Type application/gzip). Não usa o express.json, que ignora esse tipo.
router.post(
  '/backups/enviar',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const tipo = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (tipo !== 'application/gzip') {
      throw new HttpError(415, 'Envie o arquivo de cópia com Content-Type application/gzip');
    }
    const tamanhoInformado = Number(req.headers['content-length'] ?? 0);
    if (tamanhoInformado > LIMITE_ENVIO_BYTES) {
      throw new HttpError(413, MENSAGEM_LIMITE_ENVIO);
    }

    const copia = await comTrava('copia', async () => {
      await garantirEspaco();
      await fs.promises.mkdir(diretorio(), { recursive: true });
      const nome = nomeDaCopia('enviado', new Date());
      const destino = caminhoDe(nome);
      const parcial = destino + '.parcial';
      if (fs.existsSync(destino)) {
        throw new HttpError(409, 'Já existe uma cópia com este horário. Tente de novo em alguns segundos.');
      }
      try {
        await gravarEnvio(req, parcial);
        await conferirGzip(parcial);
        await fs.promises.rename(parcial, destino);
      } catch (erro) {
        await fs.promises.rm(parcial, { force: true }).catch(() => undefined);
        if (erro instanceof HttpError) throw erro;
        console.error('Falha ao gravar arquivo enviado:', mensagemSegura(erro));
        throw new HttpError(500, 'Não foi possível gravar o arquivo enviado');
      }
      const gravado = await dtoDe(nome);
      if (!gravado) throw new HttpError(500, 'Não foi possível gravar o arquivo enviado');
      return gravado;
    });
    registrar(req, 'CRIACAO', 'Enviou uma cópia de segurança', 201);
    res.status(201).json(copia);
  })
);

router.get(
  '/backups/:nome',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const nome = nomeValido(req.params.nome);
    const caminho = caminhoDe(nome);
    let estado: fs.Stats;
    try {
      estado = await fs.promises.stat(caminho);
    } catch {
      throw new HttpError(404, 'Cópia não encontrada');
    }
    if (!estado.isFile()) throw new HttpError(404, 'Cópia não encontrada');

    res.set({
      'Content-Type': 'application/gzip',
      'Content-Length': String(estado.size),
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    });
    registrar(req, 'CONSULTA', 'Baixou uma cópia de segurança', 200);
    try {
      await pipelinePromessa(fs.createReadStream(caminho), res);
    } catch (erro) {
      if (!res.headersSent) throw erro;
      console.error('Falha ao enviar cópia de segurança:', mensagemSegura(erro));
      res.destroy();
    }
  })
);

router.post(
  '/backups/:nome/restaurar',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const nome = nomeValido(req.params.nome);
    if (req.body?.confirmacao !== PALAVRA_CONFIRMACAO) {
      throw new HttpError(400, 'Para restaurar, digite RESTAURAR para confirmar');
    }
    if (!fs.existsSync(caminhoDe(nome))) {
      throw new HttpError(404, 'Cópia não encontrada');
    }

    const copiaAnterior = await comTrava('restauracao', async () => {
      let anterior: BackupDTO;
      try {
        anterior = await criarCopia('pre-restauracao');
      } catch {
        throw new HttpError(500, 'Não foi possível guardar o estado atual antes de restaurar. Nada foi alterado.');
      }
      try {
        await restaurarCopia(nome);
      } catch (erro) {
        console.error('Falha na restauração:', mensagemSegura(erro));
        throw new HttpError(
          500,
          `A restauração falhou e o banco continua como estava. O estado anterior está na cópia ${anterior.nome}.`
        );
      }
      return anterior.nome;
    });

    limparCacheConfiguracao();
    registrar(req, 'ALTERACAO', 'Restaurou o banco a partir de uma cópia', 200);
    res.json({ restaurado: true, copiaAnterior });
  })
);

router.delete(
  '/backups/:nome',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const nome = nomeValido(req.params.nome);
    if (emAndamento !== null) {
      throw new HttpError(409, MENSAGEM_OCUPADO);
    }
    try {
      await fs.promises.unlink(caminhoDe(nome));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new HttpError(404, 'Cópia não encontrada');
      }
      throw erro;
    }
    registrar(req, 'EXCLUSAO', 'Apagou uma cópia de segurança', 204);
    res.status(204).end();
  })
);

export default router;
