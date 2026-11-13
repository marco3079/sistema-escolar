// Atualizador do Sistema Escolar.
// Baixa o último commit do GitHub (ramo atual, só avanço rápido), reconstrói a API e o site e os reinicia.
// Sem dependências npm. Não publica porta: só a API fala com ele, pela rede interna do Compose.
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import fs from 'node:fs/promises';

const PORTA = 4000;
const PASTA_PROJETO = '/projeto';
const ARQ_COMPOSE = '/projeto/docker-compose.yml';
const PASTA_DADOS = '/dados';
const ARQ_IMPLANTADO = '/dados/implantado';
const ARQ_TAREFA = '/dados/tarefa.json';
const ARQ_APP_SERVIDOR = '/app/servidor.mjs';
const ARQ_APP_DOCKERFILE = '/app/Dockerfile';
const ARQ_PROJ_SERVIDOR = '/projeto/atualizador/servidor.mjs';
const ARQ_PROJ_DOCKERFILE = '/projeto/atualizador/Dockerfile';

const MINUTO = 60 * 1000;
// Folgas largas: em pasta sincronizada ou com o Docker ocupado, o Git pode levar dezenas de segundos.
const TEMPO_LEITURA = 30 * 1000;
const TEMPO_VERIFICAR = 45 * 1000;
const TEMPO_GIT = 5 * MINUTO;
const TEMPO_BUILD = 20 * MINUTO;
const TEMPO_UP = 5 * MINUTO;
const MAX_LOG = 200;
const MAX_LINHA = 500;
const MAX_NOVIDADES = 20;
const MAX_BUFFER_LINHA = 64 * 1024;
const MAX_SAIDA_COLETADA = 256 * 1024;
const ESTADOS = ['PARADA', 'EXECUTANDO', 'CONCLUIDA', 'FALHOU'];
const ETAPA_BAIXAR = 'Baixando o código';
const ETAPA_RECONSTRUIR = 'Reconstruindo';
const ETAPA_REINICIAR = 'Reiniciando';

const SEGREDO = process.env.JWT_SECRET ?? '';
const PROJETO = (process.env.PROJETO_COMPOSE ?? '').trim();
const TOKEN_ESPERADO = SEGREDO
  ? crypto.createHash('sha256').update('atualizador:' + SEGREDO).digest('hex')
  : '';
const HASH_COMMIT = /^[0-9a-f]{40,64}$/;

let tarefa = tarefaInicial();
let implantado = null; // commit completo em execução
let verificacao = { em: null, erro: null };

// ---------- utilidades ----------

function agora() {
  return new Date().toISOString();
}

function registrar(mensagem) {
  console.error('[' + agora() + '] ' + mensagem);
}

function textoErro(erro) {
  if (erro && typeof erro.message === 'string') return erro.message;
  return String(erro);
}

function cortar(texto, limite) {
  const s = String(texto);
  return s.length > limite ? s.slice(0, limite) : s;
}

// Remove "usuario:senha@" (ou só "token@") de endereços com esquema, por exemplo https://...
function ocultarCredenciais(texto) {
  return String(texto).replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1');
}

function tarefaInicial() {
  return { estado: 'PARADA', etapa: '', iniciadaEm: null, terminadaEm: null, erro: null, log: [] };
}

function adicionarLog(linha) {
  tarefa.log.push(cortar(ocultarCredenciais(linha), MAX_LINHA));
  if (tarefa.log.length > MAX_LOG) {
    tarefa.log.splice(0, tarefa.log.length - MAX_LOG);
  }
}

function ambienteFilho() {
  // Ambiente mínimo: o segredo do atualizador não é repassado aos comandos filhos.
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME || '/root',
    LANG: 'C.UTF-8',
    GIT_TERMINAL_PROMPT: '0',
  };
  if (process.env.DOCKER_HOST) env.DOCKER_HOST = process.env.DOCKER_HOST;
  for (const chave of Object.keys(env)) {
    if (env[chave] === undefined) delete env[chave];
  }
  return env;
}

// Roda um programa sem shell: argumentos sempre em lista. Nunca rejeita; devolve o resultado.
function executar(programa, argumentos, opcoes = {}) {
  const { tempoLimite, aoLinha } = opcoes;
  return new Promise((resolver) => {
    let concluido = false;
    let expirou = false;
    let temporizador = null;
    let saidaPadrao = '';
    const ultimas = [];

    const finalizar = (resultado) => {
      if (concluido) return;
      concluido = true;
      if (temporizador) clearTimeout(temporizador);
      resolver({ codigo: -1, erro: null, ...resultado, expirou, ultimas, saida: saidaPadrao });
    };

    let filho;
    try {
      filho = spawn(programa, argumentos, {
        env: ambienteFilho(),
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (erro) {
      finalizar({ erro: textoErro(erro) });
      return;
    }

    const criarLeitor = (padrao) => {
      const decodificador = new StringDecoder('utf8');
      let resto = '';
      const emitir = (linha) => {
        const limpa = linha.replace(/\r$/, '');
        ultimas.push(ocultarCredenciais(limpa));
        if (ultimas.length > 5) ultimas.shift();
        if (aoLinha) {
          try {
            aoLinha(limpa);
          } catch {
            // o registro de log nunca derruba a execução
          }
        }
      };
      return {
        receber(bloco) {
          const texto = decodificador.write(bloco);
          if (padrao && saidaPadrao.length < MAX_SAIDA_COLETADA) saidaPadrao += texto;
          resto += texto;
          let pos;
          while ((pos = resto.indexOf('\n')) !== -1) {
            emitir(resto.slice(0, pos));
            resto = resto.slice(pos + 1);
          }
          if (resto.length > MAX_BUFFER_LINHA) {
            emitir(resto);
            resto = '';
          }
        },
        fim() {
          resto += decodificador.end();
          if (resto) {
            emitir(resto);
            resto = '';
          }
        },
      };
    };

    const leitorSaida = criarLeitor(true);
    const leitorErro = criarLeitor(false);
    filho.stdout.on('data', (bloco) => leitorSaida.receber(bloco));
    filho.stderr.on('data', (bloco) => leitorErro.receber(bloco));
    filho.stdout.on('error', () => {});
    filho.stderr.on('error', () => {});

    if (tempoLimite) {
      temporizador = setTimeout(() => {
        expirou = true;
        try {
          filho.kill('SIGKILL');
        } catch {
          // já encerrado
        }
      }, tempoLimite);
    }

    filho.on('error', (erro) => {
      finalizar({ erro: textoErro(erro) });
    });
    filho.on('close', (codigo) => {
      leitorSaida.fim();
      leitorErro.fim();
      finalizar({ codigo: codigo ?? -1 });
    });
  });
}

// Git e a tarefa usam a mesma fila: nada de dois comandos Git ao mesmo tempo no repositório.
let filaGit = Promise.resolve();
function comGitExclusivo(funcao) {
  const resultado = filaGit.then(funcao);
  filaGit = resultado.catch(() => {});
  return resultado;
}

function git(argumentos, opcoes) {
  return executar('git', ['-C', PASTA_PROJETO, ...argumentos], opcoes);
}

function ramoValido(ramo) {
  return (
    typeof ramo === 'string' &&
    ramo.length > 0 &&
    ramo.length <= 200 &&
    ramo !== 'HEAD' &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ramo) &&
    !ramo.includes('..') &&
    !ramo.endsWith('/') &&
    !ramo.endsWith('.lock')
  );
}

async function lerArquivo(nome) {
  try {
    return await fs.readFile(nome, 'utf8');
  } catch {
    return null;
  }
}

async function gravarArquivo(nome, conteudo) {
  try {
    await fs.mkdir(PASTA_DADOS, { recursive: true });
    const temporario = nome + '.tmp';
    await fs.writeFile(temporario, conteudo, 'utf8');
    await fs.rename(temporario, nome);
    return true;
  } catch (erro) {
    registrar('Não foi possível gravar ' + nome + ': ' + textoErro(erro));
    return false;
  }
}

async function persistirTarefa() {
  await gravarArquivo(ARQ_TAREFA, JSON.stringify(tarefa));
}

// ---------- leitura do Git ----------

async function lerRamo() {
  const r = await git(['rev-parse', '--abbrev-ref', 'HEAD'], { tempoLimite: TEMPO_LEITURA });
  if (r.codigo !== 0) return null;
  const ramo = r.saida.trim();
  return ramoValido(ramo) ? ramo : null;
}

function interpretarCommit(linha) {
  const partes = String(linha ?? '').replace(/\r$/, '').split('\x1f');
  if (partes.length < 3 || !HASH_COMMIT.test(partes[0])) return null;
  return {
    commit: partes[0],
    curto: partes[0].slice(0, 7),
    data: partes[1],
    mensagem: partes[2],
  };
}

async function lerCommit(referencia) {
  const r = await git(['log', '-1', '--format=%H%x1f%cI%x1f%s', referencia, '--'], {
    tempoLimite: TEMPO_LEITURA,
  });
  if (r.codigo !== 0) return null;
  return interpretarCommit(r.saida.split('\n')[0]);
}

async function lerRepositorio() {
  const r = await git(['remote', 'get-url', 'origin'], { tempoLimite: TEMPO_LEITURA });
  if (r.codigo !== 0) return null;
  const url = r.saida.split('\n')[0].trim();
  return url ? ocultarCredenciais(url) : null;
}

async function lerNovidades(ramo) {
  const r = await git(
    ['log', '--max-count=' + MAX_NOVIDADES, '--format=%H%x1f%cI%x1f%s', 'HEAD..origin/' + ramo, '--'],
    { tempoLimite: TEMPO_LEITURA }
  );
  if (r.codigo !== 0) return [];
  const novidades = [];
  for (const linha of r.saida.split('\n')) {
    const commit = interpretarCommit(linha);
    if (commit) {
      novidades.push({ curto: commit.curto, mensagem: commit.mensagem, data: commit.data });
    }
  }
  return novidades;
}

async function contarAtras(ramo) {
  const r = await git(['rev-list', '--count', 'HEAD..origin/' + ramo, '--'], { tempoLimite: TEMPO_LEITURA });
  if (r.codigo !== 0) return 0;
  const numero = parseInt(r.saida.trim(), 10);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

// Hash SHA-256 do conteúdo com fim de linha normalizado (CRLF vira LF). Arquivo ausente: null.
async function hashNormalizado(nome) {
  try {
    const bruto = await fs.readFile(nome, 'utf8');
    return crypto.createHash('sha256').update(bruto.replace(/\r\n/g, '\n')).digest('hex');
  } catch {
    return null;
  }
}

async function arquivoDiferente(usado, atual) {
  const a = await hashNormalizado(usado);
  const b = await hashNormalizado(atual);
  if (a === null || b === null) return false;
  return a !== b;
}

// Compara o código em execução (/app) com o do checkout (/projeto/atualizador).
async function atualizadorMudou() {
  try {
    if (await arquivoDiferente(ARQ_APP_SERVIDOR, ARQ_PROJ_SERVIDOR)) return true;
    return await arquivoDiferente(ARQ_APP_DOCKERFILE, ARQ_PROJ_DOCKERFILE);
  } catch {
    return false;
  }
}

// Durante a atualização os comandos Git esperam a vez na fila (a tarefa a ocupa por minutos).
// Para a tela acompanhar o progresso sem travar, devolve as informações do Git já conhecidas
// e só a tarefa atualizada.
let ultimoEstado = null;
// Verdadeiro enquanto um `git fetch` de verificação está rodando (as leituras esperariam por ele).
let verificandoAgora = false;
// Verdadeiro desde o pedido de verificação até o `git fetch` terminar (inclui a espera na fila).
let verificacaoPendente = false;
// Instante e estado da tarefa em que `ultimoEstado` foi lido: por 10 s, sem mudança na tarefa, a
// resposta vem da memória (cada comando Git pode levar segundos em pasta montada pelo Docker).
let ultimoEstadoEm = 0;
let ultimoEstadoTarefa = '';
const VALIDADE_ESTADO_MS = 10 * 1000;

async function montarEstado(forcar = false) {
  const recente =
    !forcar && Date.now() - ultimoEstadoEm < VALIDADE_ESTADO_MS && ultimoEstadoTarefa === tarefa.estado;
  if ((tarefa.estado === 'EXECUTANDO' || verificandoAgora || verificacaoPendente || recente) && ultimoEstado) {
    return {
      ...ultimoEstado,
      implantado,
      tarefa: {
        estado: tarefa.estado,
        etapa: tarefa.etapa,
        iniciadaEm: tarefa.iniciadaEm,
        terminadaEm: tarefa.terminadaEm,
        erro: tarefa.erro,
        log: [...tarefa.log],
      },
    };
  }
  ultimoEstado = await montarEstadoCompleto();
  ultimoEstadoEm = Date.now();
  ultimoEstadoTarefa = tarefa.estado;
  return ultimoEstado;
}

async function montarEstadoCompleto() {
  // O instalador regrava este arquivo quando reconstrói tudo por fora do botão: relê a cada consulta.
  try {
    const lido = ((await lerArquivo(ARQ_IMPLANTADO)) ?? '').trim();
    if (HASH_COMMIT.test(lido)) implantado = lido;
  } catch {
    // segue com o valor em memória
  }
  const ramo = await lerRamo();
  const repositorio = await lerRepositorio();
  const instalado = await lerCommit('HEAD');
  let remoto = null;
  let atras = 0;
  let novidades = [];
  if (ramo) {
    remoto = await lerCommit('origin/' + ramo);
    if (remoto) {
      atras = await contarAtras(ramo);
      novidades = await lerNovidades(ramo);
    }
  }
  const precisaReconstruir =
    implantado !== null && instalado !== null && implantado !== instalado.commit;
  return {
    ramo,
    repositorio,
    instalado,
    implantado,
    remoto,
    atras,
    novidades,
    precisaReconstruir,
    atualizadorMudou: await atualizadorMudou(),
    verificadoEm: verificacao.em,
    erroVerificacao: verificacao.erro,
    tarefa: {
      estado: tarefa.estado,
      etapa: tarefa.etapa,
      iniciadaEm: tarefa.iniciadaEm,
      terminadaEm: tarefa.terminadaEm,
      erro: tarefa.erro,
      log: [...tarefa.log],
    },
  };
}

// ---------- verificação (git fetch) ----------

function resumoFalha(r) {
  const linhas = (r.ultimas ?? []).filter((l) => l.trim() !== '');
  if (r.erro) return cortar(ocultarCredenciais(r.erro), 300);
  // Prefere a linha que começa com "fatal:" ou "error:" (a causa), e não a última linha do Git.
  const causa = linhas.find((l) => /^(fatal|error):/i.test(l.trim()));
  return cortar(causa ?? (linhas.length ? linhas[linhas.length - 1] : 'código ' + r.codigo), 300);
}

async function verificarRemoto() {
  verificandoAgora = true;
  try {
    await verificarRemotoDeFato();
  } finally {
    verificandoAgora = false;
  }
}

async function verificarRemotoDeFato() {
  const em = agora();
  const ramo = await lerRamo();
  if (!ramo) {
    verificacao = {
      em,
      erro: 'A pasta do projeto não está em um ramo do Git. Instale de novo com git clone.',
    };
    return;
  }
  const r = await git(['fetch', '--prune', 'origin', ramo], { tempoLimite: TEMPO_VERIFICAR });
  if (r.codigo === 0) {
    verificacao = { em, erro: null };
  } else if (r.expirou) {
    verificacao = { em, erro: 'O GitHub não respondeu a tempo (30 segundos).' };
  } else {
    verificacao = { em, erro: 'Não foi possível buscar as novidades no GitHub: ' + resumoFalha(r) };
  }
}

// ---------- atualização (tarefa) ----------

async function definirEtapa(nome) {
  tarefa.etapa = nome;
  await persistirTarefa();
}

async function falharTarefa(etapa, r) {
  let motivo;
  if (r.expirou) motivo = 'tempo limite excedido';
  else if (r.erro) motivo = r.erro;
  else motivo = 'o comando terminou com código ' + r.codigo;
  const ultimas = (r.ultimas ?? []).filter((l) => l.trim() !== '').slice(-5).join(' | ');
  let erro = 'Falha na etapa "' + etapa + '": ' + motivo + '.';
  if (ultimas) erro += ' Últimas linhas: ' + ultimas;
  tarefa.estado = 'FALHOU';
  tarefa.etapa = etapa;
  tarefa.erro = cortar(ocultarCredenciais(erro), 1000);
  tarefa.terminadaEm = agora();
  await persistirTarefa();
}

// Roda os comandos da etapa em ordem; para no primeiro que falhar.
async function rodarComandos(etapa, comandos) {
  await definirEtapa(etapa);
  for (const comando of comandos) {
    adicionarLog('$ ' + comando.exibir);
    const r = await comando.executar();
    if (r.codigo !== 0) {
      await falharTarefa(etapa, r);
      return false;
    }
  }
  return true;
}

async function rodarAtualizacao() {
  try {
    const baixou = await comGitExclusivo(async () => {
      await definirEtapa(ETAPA_BAIXAR);
      const ramo = await lerRamo();
      if (!ramo) {
        await falharTarefa(ETAPA_BAIXAR, {
          erro: 'A pasta do projeto não está em um ramo do Git (commit solto ou sem ramo).',
        });
        return false;
      }
      return rodarComandos(ETAPA_BAIXAR, [
        {
          exibir: 'git fetch --prune origin ' + ramo,
          executar: () =>
            git(['fetch', '--prune', 'origin', ramo], { tempoLimite: TEMPO_GIT, aoLinha: adicionarLog }),
        },
        {
          exibir: 'git pull --ff-only origin ' + ramo,
          executar: () =>
            git(['pull', '--ff-only', 'origin', ramo], { tempoLimite: TEMPO_GIT, aoLinha: adicionarLog }),
        },
      ]);
    });
    if (!baixou) return;

    const reconstruiu = await rodarComandos(ETAPA_RECONSTRUIR, [
      {
        exibir: 'docker compose -p ' + PROJETO + ' build api web',
        executar: () =>
          executar(
            'docker',
            ['compose', '-p', PROJETO, '-f', ARQ_COMPOSE, 'build', 'api', 'web'],
            { tempoLimite: TEMPO_BUILD, aoLinha: adicionarLog }
          ),
      },
    ]);
    if (!reconstruiu) return;

    const reiniciou = await rodarComandos(ETAPA_REINICIAR, [
      {
        exibir: 'docker compose -p ' + PROJETO + ' up -d --no-deps api web',
        executar: () =>
          executar(
            'docker',
            ['compose', '-p', PROJETO, '-f', ARQ_COMPOSE, 'up', '-d', '--no-deps', 'api', 'web'],
            { tempoLimite: TEMPO_UP, aoLinha: adicionarLog }
          ),
      },
    ]);
    if (!reiniciou) return;

    const head = await lerCommit('HEAD');
    if (head) {
      implantado = head.commit;
      const gravou = await gravarArquivo(ARQ_IMPLANTADO, head.commit + '\n');
      if (!gravou) adicionarLog('Aviso: não foi possível gravar o commit implantado.');
    } else {
      adicionarLog('Aviso: não foi possível ler o commit atual depois da atualização.');
    }
    tarefa.estado = 'CONCLUIDA';
    tarefa.etapa = 'Concluída';
    tarefa.terminadaEm = agora();
    await persistirTarefa();
  } catch (erro) {
    registrar('Erro inesperado na atualização: ' + ocultarCredenciais(textoErro(erro)));
    try {
      await falharTarefa(tarefa.etapa || 'Atualização', { erro: textoErro(erro) });
    } catch {
      // nada mais a fazer além do registro
    }
  }
}

function iniciarAtualizacao() {
  // Estado vai para EXECUTANDO antes de qualquer await, para que dois POST não iniciem duas tarefas.
  tarefa = {
    estado: 'EXECUTANDO',
    etapa: 'Iniciando',
    iniciadaEm: agora(),
    terminadaEm: null,
    erro: null,
    log: [],
  };
  persistirTarefa().catch(() => {});
  rodarAtualizacao().catch((erro) => registrar('Falha ao rodar a atualização: ' + textoErro(erro)));
}

// ---------- inicialização ----------

async function iniciar() {
  try {
    const lista = await executar('git', ['config', '--global', '--get-all', 'safe.directory'], {
      tempoLimite: TEMPO_LEITURA,
    });
    const jaConfigurado = lista.saida.split('\n').map((l) => l.trim()).includes(PASTA_PROJETO);
    if (!jaConfigurado) {
      const r = await executar('git', ['config', '--global', '--add', 'safe.directory', PASTA_PROJETO], {
        tempoLimite: TEMPO_LEITURA,
      });
      if (r.codigo !== 0) registrar('Não foi possível configurar safe.directory: ' + resumoFalha(r));
    }
  } catch (erro) {
    registrar('Erro ao configurar o Git: ' + textoErro(erro));
  }

  try {
    const lido = ((await lerArquivo(ARQ_IMPLANTADO)) ?? '').trim();
    if (HASH_COMMIT.test(lido)) {
      implantado = lido;
    } else {
      // Primeira subida: o instalador acabou de construir tudo, então o commit atual é o implantado.
      const head = await lerCommit('HEAD');
      implantado = head ? head.commit : null;
      if (head) await gravarArquivo(ARQ_IMPLANTADO, head.commit + '\n');
    }
  } catch (erro) {
    registrar('Erro ao ler o commit atual: ' + textoErro(erro));
  }

  try {
    const bruto = await lerArquivo(ARQ_TAREFA);
    let salvo = null;
    try {
      salvo = JSON.parse(bruto ?? 'null');
    } catch {
      salvo = null;
    }
    if (salvo && typeof salvo === 'object' && ESTADOS.includes(salvo.estado)) {
      tarefa = {
        estado: salvo.estado,
        etapa: typeof salvo.etapa === 'string' ? salvo.etapa : '',
        iniciadaEm: typeof salvo.iniciadaEm === 'string' ? salvo.iniciadaEm : null,
        terminadaEm: typeof salvo.terminadaEm === 'string' ? salvo.terminadaEm : null,
        erro: typeof salvo.erro === 'string' ? salvo.erro : null,
        log: Array.isArray(salvo.log)
          ? salvo.log.filter((l) => typeof l === 'string').slice(-MAX_LOG).map((l) => cortar(l, MAX_LINHA))
          : [],
      };
      if (tarefa.estado === 'EXECUTANDO') {
        tarefa.estado = 'FALHOU';
        tarefa.erro = 'O atualizador reiniciou durante a atualização';
        tarefa.terminadaEm = agora();
        await persistirTarefa();
      }
    }
  } catch (erro) {
    registrar('Erro ao ler a tarefa anterior: ' + textoErro(erro));
  }

  if (!SEGREDO) registrar('JWT_SECRET vazio: o atualizador responde 503 até o instalador configurar o .env.');
  if (!PROJETO) registrar('PROJETO_COMPOSE vazio: a atualização fica indisponível até o instalador gravar COMPOSE_PROJECT_NAME.');
}

// ---------- HTTP ----------

function enviarJson(res, status, corpo, cabecalhos = {}) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(texto),
    ...cabecalhos,
  });
  res.end(texto);
}

function tokenValido(req) {
  if (!TOKEN_ESPERADO) return false;
  const recebido = req.headers['x-atualizador-token'];
  if (typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido, 'utf8');
  const b = Buffer.from(TOKEN_ESPERADO, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function tratar(req, res) {
  // O corpo da requisição é ignorado; só drenamos para não deixar a conexão presa.
  req.resume();

  if (!TOKEN_ESPERADO) {
    return enviarJson(res, 503, { erro: 'JWT_SECRET não definido: o atualizador está desligado.' });
  }
  if (!tokenValido(req)) {
    return enviarJson(res, 401, { erro: 'Não autorizado.' });
  }

  const url = new URL(req.url ?? '/', 'http://atualizador.local');

  if (url.pathname === '/estado') {
    if (req.method !== 'GET') {
      return enviarJson(res, 405, { erro: 'Método não permitido.' }, { Allow: 'GET' });
    }
    // A verificação (git fetch) roda em segundo plano: a resposta sai na hora com `verificando: true`
    // e quem consulta repete o GET /estado até `verificando` voltar a false.
    const verificar = url.searchParams.get('verificar') === '1';
    if (verificar && !verificacaoPendente && tarefa.estado !== 'EXECUTANDO') {
      // A marca sobe antes de qualquer espera, para duas chamadas juntas não dispararem dois fetch.
      verificacaoPendente = true;
      try {
        if (!ultimoEstado) await montarEstado(true);
      } catch (erro) {
        verificacaoPendente = false;
        throw erro;
      }
      comGitExclusivo(verificarRemoto)
        .catch((erro) => registrar('Erro na verificação: ' + textoErro(erro)))
        .finally(() => {
          verificacaoPendente = false;
          ultimoEstadoEm = 0; // força a releitura na próxima consulta
        });
    }
    const estado = await montarEstado();
    return enviarJson(res, 200, { ...estado, verificando: verificacaoPendente });
  }

  if (url.pathname === '/atualizar') {
    if (req.method !== 'POST') {
      return enviarJson(res, 405, { erro: 'Método não permitido.' }, { Allow: 'POST' });
    }
    if (tarefa.estado === 'EXECUTANDO') {
      return enviarJson(res, 409, { erro: 'Já existe uma atualização em andamento' });
    }
    if (!PROJETO) {
      return enviarJson(res, 503, {
        erro: 'PROJETO_COMPOSE não definido no atualizador. Rode o instalador de novo.',
      });
    }
    iniciarAtualizacao();
    return enviarJson(res, 202, { iniciada: true });
  }

  return enviarJson(res, 404, { erro: 'Não encontrado.' });
}

process.on('uncaughtException', (erro) => {
  registrar('Erro não tratado: ' + ocultarCredenciais(textoErro(erro)));
});
process.on('unhandledRejection', (erro) => {
  registrar('Promessa rejeitada: ' + ocultarCredenciais(textoErro(erro)));
});

const servidor = http.createServer((req, res) => {
  tratar(req, res).catch((erro) => {
    registrar('Erro na requisição: ' + ocultarCredenciais(textoErro(erro)));
    try {
      if (!res.headersSent) {
        enviarJson(res, 500, { erro: 'Erro interno do atualizador.' });
      } else {
        res.end();
      }
    } catch {
      // conexão já fechada
    }
  });
});

servidor.on('error', (erro) => {
  registrar('Erro no servidor HTTP: ' + ocultarCredenciais(textoErro(erro)));
});

(async () => {
  try {
    await iniciar();
  } catch (erro) {
    registrar('Erro na inicialização: ' + ocultarCredenciais(textoErro(erro)));
  }
  servidor.listen(PORTA, '0.0.0.0', () => {
    registrar('Atualizador ouvindo na porta ' + PORTA + '.');
  });
})();
