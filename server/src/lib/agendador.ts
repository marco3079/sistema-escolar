import fs from 'fs';
import path from 'path';

// Agendador simples: um relógio que verifica a cada minuto e dispara as tarefas registradas.
// Contrato em docs/plano/quinta-leva.md, "Contrato A".

interface TarefaDiaria {
  nome: string;
  hora: number | (() => Promise<number | null>);
  tarefa: () => Promise<void>;
  executando: boolean;
}

interface TarefaPeriodica {
  nome: string;
  minutos: number;
  tarefa: () => Promise<void>;
  ultimaInicio: number;
  executando: boolean;
}

const INTERVALO_VERIFICACAO_MS = 60_000;

const diarias = new Map<string, TarefaDiaria>();
const periodicas = new Map<string, TarefaPeriodica>();
// Data (AAAA-MM-DD, relógio do servidor) da última execução de cada tarefa diária.
const ultimasExecucoes = new Map<string, string>();

let estadoCarregado = false;
let avisoDeGravacaoEmitido = false;
let iniciado = false;

function diretorioDados(): string {
  return process.env.DIRETORIO_DADOS ?? '/dados';
}

function arquivoEstado(): string {
  return path.join(diretorioDados(), 'agendador.json');
}

function dataLocal(agora: Date): string {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function carregarEstado(): void {
  if (estadoCarregado) {
    return;
  }
  estadoCarregado = true;
  try {
    const bruto = fs.readFileSync(arquivoEstado(), 'utf8');
    const dados = JSON.parse(bruto) as unknown;
    if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
      for (const [nome, data] of Object.entries(dados as Record<string, unknown>)) {
        if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
          ultimasExecucoes.set(nome, data);
        }
      }
    }
  } catch {
    // Sem arquivo (primeira subida) ou arquivo ilegível: começa do zero na memória.
  }
}

function gravarEstado(): void {
  const dados: Record<string, string> = {};
  for (const [nome, data] of ultimasExecucoes) {
    dados[nome] = data;
  }
  fs.promises.writeFile(arquivoEstado(), JSON.stringify(dados, null, 2), 'utf8').catch(() => {
    if (!avisoDeGravacaoEmitido) {
      avisoDeGravacaoEmitido = true;
      console.warn('Agendador: não foi possível gravar agendador.json; as datas ficam só em memória.');
    }
  });
}

function registrarErro(nome: string, erro: unknown): void {
  console.error(`Tarefa agendada "${nome}" falhou:`, erro instanceof Error ? erro.message : erro);
}

async function resolverHora(tarefa: TarefaDiaria): Promise<number | null> {
  if (typeof tarefa.hora === 'number') {
    return tarefa.hora;
  }
  try {
    return await tarefa.hora();
  } catch (erro) {
    registrarErro(`${tarefa.nome} (hora)`, erro);
    return null;
  }
}

function executarDiaria(tarefa: TarefaDiaria, hoje: string): void {
  tarefa.executando = true;
  // Marca o dia antes de rodar: uma falha não faz a tarefa repetir no mesmo dia.
  ultimasExecucoes.set(tarefa.nome, hoje);
  gravarEstado();
  tarefa
    .tarefa()
    .catch((erro) => registrarErro(tarefa.nome, erro))
    .finally(() => {
      tarefa.executando = false;
    });
}

function executarPeriodica(tarefa: TarefaPeriodica, agora: number): void {
  tarefa.executando = true;
  tarefa.ultimaInicio = agora;
  tarefa
    .tarefa()
    .catch((erro) => registrarErro(tarefa.nome, erro))
    .finally(() => {
      tarefa.executando = false;
    });
}

async function verificar(): Promise<void> {
  try {
    carregarEstado();
    const agora = new Date();
    const hoje = dataLocal(agora);

    for (const tarefa of diarias.values()) {
      if (tarefa.executando) {
        continue;
      }
      const hora = await resolverHora(tarefa);
      if (hora === null || !Number.isInteger(hora) || hora < 0 || hora > 23) {
        continue;
      }
      // Já passou da hora e ainda não rodou hoje: roda agora (cobre servidor que estava desligado).
      if (agora.getHours() < hora) {
        continue;
      }
      if (ultimasExecucoes.get(tarefa.nome) === hoje) {
        continue;
      }
      executarDiaria(tarefa, hoje);
    }

    const agoraMs = agora.getTime();
    for (const tarefa of periodicas.values()) {
      if (tarefa.executando) {
        continue;
      }
      if (agoraMs - tarefa.ultimaInicio < tarefa.minutos * 60_000) {
        continue;
      }
      executarPeriodica(tarefa, agoraMs);
    }
  } catch (erro) {
    console.error('Agendador: falha na verificação:', erro instanceof Error ? erro.message : erro);
  }
}

// Registra uma tarefa que roda uma vez por dia na hora dada (0 a 23, relógio do servidor).
// `hora` pode ser função (lida a cada verificação); devolver null = desligada.
export function registrarTarefaDiaria(
  nome: string,
  hora: number | (() => Promise<number | null>),
  tarefa: () => Promise<void>
): void {
  const existente = diarias.get(nome);
  diarias.set(nome, { nome, hora, tarefa, executando: existente?.executando ?? false });
}

// Registra uma tarefa que roda a cada `minutos`.
export function registrarTarefaPeriodica(nome: string, minutos: number, tarefa: () => Promise<void>): void {
  const existente = periodicas.get(nome);
  periodicas.set(nome, {
    nome,
    minutos,
    tarefa,
    ultimaInicio: existente?.ultimaInicio ?? 0,
    executando: existente?.executando ?? false,
  });
}

// Liga o relógio (verifica a cada minuto). Chamado uma vez em server.ts, depois de criar o app.
export function iniciarAgendador(): void {
  if (iniciado) {
    return;
  }
  iniciado = true;
  void verificar();
  const relogio = setInterval(() => {
    void verificar();
  }, INTERVALO_VERIFICACAO_MS);
  relogio.unref();
}
