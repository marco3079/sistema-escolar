import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Aviso, Botao, Modal, Selo } from '../../ui';
import { GabaritoAluno } from './ProvaGabarito';
import './provas.css';
import {
  INTERVALO_REENVIO_MS,
  INTERVALO_SALVAR_MS,
  LIMITE_PARA_SALVAR_MS,
  MAXIMO_REENVIOS_AUTOMATICOS,
  VF_FALSO,
  VF_VERDADEIRO,
  formatarNumero,
  formatarTempo,
  mensagemErroProva,
  questaoRespondida,
  rotuloPontos,
  rotuloVF,
} from './ProvaTipos';
import type {
  EnviarProvaResposta,
  IniciarProvaResposta,
  ProvaDTO,
  RespostaAluno,
} from './ProvaTipos';

// Nos últimos 2 minutos, o cronômetro fica vermelho.
const ALERTA_TEMPO_MS = 2 * 60 * 1000;

function horaDoDia(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Tela de realização: uma questão por vez, cronômetro pelo servidor e salvamento automático.
// Recarregar a página retoma: o chamador faz POST /iniciar de novo e recebe a mesma tentativa.
export function ProvaRealizar({
  prova,
  dados,
  aoSair,
}: {
  prova: ProvaDTO;
  dados: IniciarProvaResposta;
  aoSair: () => void;
}) {
  const questoes = dados.questoes;
  const total = questoes.length;
  const expiraMs = Date.parse(dados.tentativa.expiraEm);

  // Diferença entre o relógio do servidor (agora de /iniciar) e o relógio local nesse instante.
  // Assim o cronômetro não depende do relógio do aparelho.
  const [desvioMs] = useState<number>(() => {
    const servidor = Date.parse(dados.agora);
    return Number.isNaN(servidor) ? 0 : servidor - Date.now();
  });

  const [agoraMs, setAgoraMs] = useState<number>(() => Date.now());
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, RespostaAluno>>(() => {
    const mapa: Record<number, RespostaAluno> = {};
    for (const q of questoes) mapa[q.id] = { questaoId: q.id, alternativa: null, texto: '' };
    for (const r of dados.respostas) {
      mapa[r.questaoId] = { questaoId: r.questaoId, alternativa: r.alternativa ?? null, texto: r.texto ?? '' };
    }
    return mapa;
  });
  const [estadoSalvar, setEstadoSalvar] = useState<'salvo' | 'pendente' | 'salvando' | 'erro'>('salvo');
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [horaSalvo, setHoraSalvo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);
  const [resultado, setResultado] = useState<EnviarProvaResposta | null>(null);

  // Fonte da verdade das respostas (síncrona), e controle do salvamento.
  const respostasRef = useRef<Record<number, RespostaAluno>>(respostas);
  const versaoRef = useRef(0); // sobe a cada mudança do aluno
  const salvaRef = useRef(0); // última versão gravada no servidor
  const salvandoRef = useRef(false); // uma requisição por vez
  const debounceRef = useRef<number | undefined>(undefined);
  const esperaRef = useRef<{ id: number; resolver: () => void } | null>(null);
  const montadoRef = useRef(true);
  const encerradaRef = useRef(false); // prova enviada
  const enviandoRef = useRef(false);
  const autoEnvioRef = useRef(false); // envio automático começa uma única vez

  // Corpo com todas as respostas no momento da chamada.
  function corpoRespostas(): RespostaAluno[] {
    return questoes.map((q) => respostasRef.current[q.id] ?? { questaoId: q.id, alternativa: null, texto: '' });
  }

  // Salva as respostas. Só uma requisição por vez: se houver mudança durante o envio, envia de novo ao terminar.
  async function salvar(): Promise<void> {
    if (salvandoRef.current || encerradaRef.current) return;
    const versao = versaoRef.current;
    if (versao === salvaRef.current) return;

    salvandoRef.current = true;
    setEstadoSalvar('salvando');
    let falhou = false;
    try {
      await api.put(`/provas/${prova.id}/respostas`, { respostas: corpoRespostas() });
      salvaRef.current = versao;
      if (montadoRef.current) {
        setErroSalvar(null);
        setHoraSalvo(horaDoDia());
      }
    } catch (e) {
      falhou = true;
      if (montadoRef.current) setErroSalvar(mensagemErroProva(e));
    } finally {
      salvandoRef.current = false;
    }

    if (!montadoRef.current) return;
    if (falhou) {
      // Não reenvia logo (evita laço); o intervalo de 20 s e a próxima mudança tentam de novo.
      setEstadoSalvar('erro');
      return;
    }
    if (versaoRef.current !== salvaRef.current) {
      void salvar();
    } else {
      setEstadoSalvar('salvo');
    }
  }

  function responder(questaoId: number, parcial: Partial<Omit<RespostaAluno, 'questaoId'>>) {
    if (encerradaRef.current) return;
    const atual = respostasRef.current[questaoId] ?? { questaoId, alternativa: null, texto: '' };
    respostasRef.current = { ...respostasRef.current, [questaoId]: { ...atual, ...parcial } };
    setRespostas(respostasRef.current);
    versaoRef.current += 1;
    setEstadoSalvar('pendente');
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void salvar(), LIMITE_PARA_SALVAR_MS);
  }

  // Espera com cancelamento: ao sair da tela, o temporizador é limpo e a espera termina.
  function esperar(ms: number): Promise<void> {
    return new Promise((resolver) => {
      const id = window.setTimeout(() => {
        esperaRef.current = null;
        resolver();
      }, ms);
      esperaRef.current = { id, resolver };
    });
  }

  // Envio final (manual ou automático). Manda também as respostas atuais, para não depender do último salvamento.
  // Automático: tenta de novo até MAXIMO_REENVIOS_AUTOMATICOS vezes, com intervalo; depois mostra o erro.
  async function enviar(automatico: boolean): Promise<void> {
    if (enviandoRef.current || encerradaRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErroEnvio(null);
    setConfirmarEnvio(false);

    const tentativasMax = automatico ? 1 + MAXIMO_REENVIOS_AUTOMATICOS : 1;
    let erro: unknown = null;
    for (let n = 1; n <= tentativasMax; n++) {
      if (!montadoRef.current || encerradaRef.current) break;
      try {
        const r = await api.post<EnviarProvaResposta>(`/provas/${prova.id}/enviar`, { respostas: corpoRespostas() });
        encerradaRef.current = true;
        window.clearTimeout(debounceRef.current);
        erro = null;
        if (montadoRef.current) setResultado(r);
        break;
      } catch (e) {
        erro = e;
        if (n < tentativasMax && montadoRef.current) await esperar(INTERVALO_REENVIO_MS);
      }
    }

    enviandoRef.current = false;
    if (montadoRef.current) {
      setEnviando(false);
      if (erro) {
        const motivo = mensagemErroProva(erro);
        setErroEnvio(
          automatico
            ? `O tempo acabou, mas o envio não foi concluído (${motivo}). Toque em "Enviar prova" para tentar de novo.`
            : motivo,
        );
      }
    }
  }

  // Cronômetro: atualiza a cada segundo a partir do relógio do servidor.
  useEffect(() => {
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const restanteMs = expiraMs - (agoraMs + desvioMs);
  const expirou = restanteMs <= 0;

  // Tempo acabou: envia sozinho uma única vez (com novas tentativas em caso de falha).
  useEffect(() => {
    if (!expirou || autoEnvioRef.current || encerradaRef.current) return;
    autoEnvioRef.current = true;
    void enviar(true);
    // enviar usa só refs e props estáveis; roda uma vez quando o tempo acaba.
  }, [expirou]);

  // Salvamento periódico (a cada 20 s, se houver mudança) e gravação ao sair da tela.
  useEffect(() => {
    montadoRef.current = true;
    const id = window.setInterval(() => void salvar(), INTERVALO_SALVAR_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(debounceRef.current);
      if (esperaRef.current) {
        window.clearTimeout(esperaRef.current.id);
        esperaRef.current.resolver();
        esperaRef.current = null;
      }
      // Grava o que faltou ao sair (ex.: trocar de aba), sem esperar a resposta.
      void salvar();
      montadoRef.current = false;
    };
    // salvar usa só refs e props estáveis.
  }, []);

  // Aviso do navegador ao tentar sair ou recarregar, só enquanto a prova está em andamento.
  const emAndamento = resultado === null;
  useEffect(() => {
    if (!emAndamento) return;
    function aoSairDaPagina(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', aoSairDaPagina);
    return () => window.removeEventListener('beforeunload', aoSairDaPagina);
  }, [emAndamento]);

  // ---------- Tela final ----------
  if (resultado) {
    return (
      <section className="prova-realizar prova-final">
        <div className="cartao prova-final-cartao">
          <h2>Prova enviada</h2>
          <p className="prova-texto">{prova.titulo}</p>
          {resultado.corrigida && resultado.notaFinal !== null ? (
            <p className="prova-nota-destaque">
              Nota: {formatarNumero(resultado.notaFinal)} de {formatarNumero(prova.notaMaxima)}
            </p>
          ) : (
            <p className="prova-texto">
              Aguardando a correção das questões dissertativas. A nota aparece aqui quando o professor corrigir.
            </p>
          )}
          <div className="prova-acoes">
            <Botao aoClicar={aoSair}>Voltar às provas</Botao>
          </div>
        </div>
        <GabaritoAluno provaId={prova.id} />
      </section>
    );
  }

  const questao = questoes[indice];
  const respondidas = questoes.filter((q) => questaoRespondida(q, respostas[q.id])).length;
  const alerta = restanteMs <= ALERTA_TEMPO_MS;

  const rotuloSalvar =
    estadoSalvar === 'salvando'
      ? 'Salvando...'
      : estadoSalvar === 'pendente'
        ? 'Alterações não salvas'
        : estadoSalvar === 'erro'
          ? 'Não foi possível salvar'
          : horaSalvo
            ? `Salvo às ${horaSalvo}`
            : 'Respostas salvas';
  const corSalvar = estadoSalvar === 'erro' ? 'vermelho' : estadoSalvar === 'pendente' ? 'amarelo' : 'verde';

  // Opções da questão com o valor gravado em `alternativa`.
  const opcoes: { valor: number; texto: string }[] = !questao
    ? []
    : questao.tipo === 'VERDADEIRO_FALSO'
      ? [
          { valor: VF_VERDADEIRO, texto: rotuloVF(VF_VERDADEIRO) },
          { valor: VF_FALSO, texto: rotuloVF(VF_FALSO) },
        ]
      : questao.alternativas.map((texto, valor) => ({ valor, texto }));

  return (
    <section className="prova-realizar">
      <div className="cartao prova-topo">
        <div className="prova-topo-info">
          <h2 className="prova-titulo-grande">{prova.titulo}</h2>
          <span className="prova-realizar-contagem">
            {respondidas} de {total} respondidas
          </span>
          <Selo cor={corSalvar}>{rotuloSalvar}</Selo>
        </div>
        <div
          className={alerta ? 'prova-tempo prova-tempo-alerta' : 'prova-tempo'}
          role="timer"
          aria-label="Tempo restante"
        >
          <span className="prova-rotulo-pequeno">Tempo restante</span>
          <strong className="prova-tempo-numero">{formatarTempo(Math.max(0, restanteMs))}</strong>
        </div>
      </div>

      {erroSalvar && estadoSalvar === 'erro' && <Aviso tipo="erro">{erroSalvar}</Aviso>}
      {erroEnvio && <Aviso tipo="erro">{erroEnvio}</Aviso>}

      {prova.instrucoes.trim() !== '' && (
        <details className="prova-instrucoes">
          <summary>Instruções da prova</summary>
          <p className="prova-texto">{prova.instrucoes}</p>
        </details>
      )}

      {questao && (
        <article className="cartao prova-questao-aluno">
          <header className="prova-questao-cabecalho">
            <strong className="prova-questao-titulo">
              Questão {indice + 1} de {total}
            </strong>
            <span className="prova-questao-pontos">{rotuloPontos(questao.pontos)}</span>
          </header>
          <p className="prova-enunciado">{questao.enunciado}</p>

          {questao.tipo === 'DISSERTATIVA' ? (
            <textarea
              className="campo-controle prova-dissertativa"
              rows={8}
              aria-label={`Resposta da questão ${indice + 1}`}
              value={respostas[questao.id]?.texto ?? ''}
              onChange={(e) => responder(questao.id, { texto: e.target.value })}
            />
          ) : (
            <div className="prova-opcoes" role="radiogroup" aria-label={`Alternativas da questão ${indice + 1}`}>
              {opcoes.map(({ valor, texto }, i) => {
                const marcada = respostas[questao.id]?.alternativa === valor;
                return (
                  <label key={valor} className={marcada ? 'prova-opcao prova-opcao-marcada' : 'prova-opcao'}>
                    <input
                      type="radio"
                      className="prova-opcao-radio"
                      name={`prova-resposta-${questao.id}`}
                      checked={marcada}
                      onChange={() => responder(questao.id, { alternativa: valor })}
                    />
                    {questao.tipo === 'OBJETIVA' && (
                      <span className="prova-opcao-letra">{String.fromCharCode(65 + i)}</span>
                    )}
                    <span className="prova-opcao-texto">{texto}</span>
                  </label>
                );
              })}
            </div>
          )}

          <nav className="prova-navegacao" aria-label="Trocar de questão">
            <Botao variante="secundario" desabilitado={indice === 0} aoClicar={() => setIndice((i) => i - 1)}>
              Anterior
            </Botao>
            <Botao
              variante="secundario"
              desabilitado={indice >= total - 1}
              aoClicar={() => setIndice((i) => i + 1)}
            >
              Próxima
            </Botao>
          </nav>
        </article>
      )}

      <nav className="prova-mapa" aria-label="Mapa de questões">
        {questoes.map((q, i) => {
          const feita = questaoRespondida(q, respostas[q.id]);
          const atual = i === indice;
          const classes = ['prova-mapa-item', feita ? 'prova-mapa-feita' : '', atual ? 'prova-mapa-atual' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={q.id}
              type="button"
              className={classes}
              aria-label={`Questão ${i + 1}${feita ? ', respondida' : ', não respondida'}`}
              aria-current={atual ? 'step' : undefined}
              onClick={() => setIndice(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      <div className="prova-realizar-rodape">
        <Botao variante="secundario" aoClicar={aoSair}>
          Sair e continuar depois
        </Botao>
        <Botao desabilitado={enviando} aoClicar={() => setConfirmarEnvio(true)}>
          {enviando ? 'Enviando...' : 'Enviar prova'}
        </Botao>
      </div>

      <Modal aberto={confirmarEnvio} titulo="Enviar a prova?" aoFechar={() => setConfirmarEnvio(false)}>
        <p className="prova-texto">
          Você respondeu {respondidas} de {total} questões. Depois de enviada, a prova não pode mais ser alterada.
        </p>
        <div className="prova-acoes">
          <Botao variante="secundario" aoClicar={() => setConfirmarEnvio(false)}>
            Continuar respondendo
          </Botao>
          <Botao desabilitado={enviando} aoClicar={() => void enviar(false)}>
            Enviar prova
          </Botao>
        </div>
      </Modal>
    </section>
  );
}
