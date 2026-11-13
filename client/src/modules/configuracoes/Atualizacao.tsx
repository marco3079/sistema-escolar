import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Aviso, Botao, Carregando, Cartao, Modal, Selo, formatarDataHora } from '../../ui';
import { mensagemErro } from '../cadastros/tipos';
import type { AtualizacaoDTO, CommitInfo, EstadoAtualizacao } from './tipos';

type Disponivel = { disponivel: true } & EstadoAtualizacao;
type Tarefa = EstadoAtualizacao['tarefa'];

// Etapas na ordem do atualizador (contrato W).
const ETAPAS = ['Baixando o código', 'Reconstruindo', 'Reiniciando', 'Concluída'];

// Consulta de acompanhamento: uma por vez, a cada 2 s, encadeada com setTimeout.
const INTERVALO_CONSULTA_MS = 2000;
// A API reinicia na etapa "Reiniciando": falhas de rede são esperadas por até 5 minutos.
const LIMITE_FALHAS_MS = 5 * 60 * 1000;
// Depois de iniciar, se a tarefa não aparecer como EXECUTANDO nesse tempo, para de esperar.
const TOLERANCIA_INICIO_MS = 15 * 1000;

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Índice da etapa a partir do texto que o atualizador envia (ex.: "Reconstruindo").
function indiceEtapa(etapa: string): number {
  const alvo = semAcento(etapa);
  const i = ETAPAS.findIndex((e) => alvo.includes(semAcento(e).split(' ')[0]));
  return i < 0 ? 0 : i;
}

function Commit({ info }: { info: CommitInfo | null }) {
  if (!info) return <p className="config-ajuda-campo">Nenhum commit conhecido.</p>;
  return (
    <div className="config-commit">
      <div className="config-commit-topo">
        <code className="config-commit-codigo">{info.curto}</code>
        <span className="config-ajuda-campo">{formatarDataHora(info.data) || '—'}</span>
      </div>
      <p className="config-commit-mensagem">{info.mensagem}</p>
    </div>
  );
}

function SituacaoRemoto({ d }: { d: Disponivel }) {
  if (d.remoto === null) return <Selo cor="cinza">Sem informação</Selo>;
  if (d.atras > 0) {
    return <Selo cor="amarelo">{`${d.atras} atualização(ões) disponível(is)`}</Selo>;
  }
  if (d.precisaReconstruir) return <Selo cor="amarelo">Reconstrução pendente</Selo>;
  return <Selo cor="verde">Atualizado</Selo>;
}

function Etapas({ tarefa }: { tarefa: Tarefa }) {
  const atual = tarefa.estado === 'CONCLUIDA' ? ETAPAS.length : indiceEtapa(tarefa.etapa);
  return (
    <ol className="config-etapas">
      {ETAPAS.map((rotulo, i) => {
        let situacao: 'feita' | 'atual' | 'erro' | 'pendente';
        if (i < atual) {
          situacao = 'feita';
        } else if (i === atual) {
          if (tarefa.estado === 'FALHOU') situacao = 'erro';
          else if (tarefa.estado === 'CONCLUIDA') situacao = 'feita';
          else situacao = 'atual';
        } else {
          situacao = 'pendente';
        }
        return (
          <li
            key={rotulo}
            className={`config-etapa config-etapa-${situacao}`}
            aria-current={situacao === 'atual' ? 'step' : undefined}
          >
            {rotulo}
          </li>
        );
      })}
    </ol>
  );
}

// Log com rolagem que acompanha o fim.
function LogTarefa({ linhas }: { linhas: string[] }) {
  const ref = useRef<HTMLPreElement>(null);
  const texto = linhas.join('\n');
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [texto]);
  return (
    <pre ref={ref} className="config-log" aria-label="Registro da atualização">
      {texto || 'Sem saída ainda.'}
    </pre>
  );
}

function TarefaAtualizacao({ tarefa }: { tarefa: Tarefa }) {
  if (tarefa.estado === 'EXECUTANDO') {
    return (
      <Cartao titulo="Atualização em andamento">
        <Etapas tarefa={tarefa} />
        <p className="config-ajuda-campo">
          Etapa atual: <strong>{tarefa.etapa}</strong>
        </p>
        <LogTarefa linhas={tarefa.log} />
      </Cartao>
    );
  }
  if (tarefa.estado === 'CONCLUIDA') {
    // Só pede para recarregar logo depois da atualização; mais tarde vira um registro simples.
    const fim = tarefa.terminadaEm ? new Date(tarefa.terminadaEm).getTime() : Date.now();
    if (Date.now() - fim > 10 * 60 * 1000) {
      return (
        <Cartao titulo="Última atualização">
          <p className="config-ajuda-campo">
            Concluída em {new Date(fim).toLocaleString('pt-BR')}.
          </p>
        </Cartao>
      );
    }
    return (
      <Cartao titulo="Atualização">
        <Aviso tipo="sucesso">
          Atualização concluída. Recarregue a página para usar a versão nova.
        </Aviso>
        <div className="config-atualizacao-acoes">
          <Botao aoClicar={() => window.location.reload()}>Recarregar a página</Botao>
        </div>
        <LogTarefa linhas={tarefa.log} />
      </Cartao>
    );
  }
  if (tarefa.estado === 'FALHOU') {
    return (
      <Cartao titulo="Atualização">
        <Aviso tipo="erro">{tarefa.erro ?? 'A atualização falhou.'}</Aviso>
        <Etapas tarefa={tarefa} />
        <LogTarefa linhas={tarefa.log} />
      </Cartao>
    );
  }
  return null;
}

export function Atualizacao() {
  const [dados, setDados] = useState<AtualizacaoDTO | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  // Acompanhamento ativo. aguardarInicio: logo após o POST, a primeira leitura ainda pode mostrar a tarefa anterior.
  const [acompanhando, setAcompanhando] = useState<{ aguardarInicio: boolean } | null>(null);
  const [reiniciando, setReiniciando] = useState(false);
  const [erroAcompanhar, setErroAcompanhar] = useState<string | null>(null);

  const vivo = useRef(false);
  const verificandoRef = useRef(false);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  // Consulta com verificação no GitHub (uma por vez).
  const verificar = useCallback(async () => {
    if (verificandoRef.current) return;
    verificandoRef.current = true;
    setVerificando(true);
    setErroCarga(null);
    setErroAcompanhar(null);
    try {
      let novo = await api.get<AtualizacaoDTO>('/atualizacao?verificar=1');
      if (!vivo.current) return;
      setDados(novo);
      // A busca no GitHub roda em segundo plano no servidor: acompanha até terminar (no máximo 3 minutos).
      const limite = Date.now() + 3 * 60 * 1000;
      while (novo.disponivel && novo.verificando && Date.now() < limite) {
        await new Promise((resolver) => window.setTimeout(resolver, 2000));
        if (!vivo.current) return;
        novo = await api.get<AtualizacaoDTO>('/atualizacao');
        if (!vivo.current) return;
        setDados(novo);
      }
      if (novo.disponivel && novo.tarefa.estado === 'EXECUTANDO') {
        setAcompanhando((atual) => atual ?? { aguardarInicio: false });
      }
    } catch (e) {
      if (vivo.current) setErroCarga(mensagemErro(e));
    } finally {
      verificandoRef.current = false;
      if (vivo.current) setVerificando(false);
    }
  }, []);

  useEffect(() => {
    void verificar();
  }, [verificar]);

  // Acompanhamento da tarefa: uma consulta por vez; limpa o temporizador ao sair da tela ou ao parar.
  useEffect(() => {
    if (!acompanhando) return;
    let ativo = true;
    let timer: number | undefined;
    const inicio = Date.now();
    let vimosExecutando = !acompanhando.aguardarInicio;
    let falhasDesde: number | null = null;

    async function consultar() {
      let deuCerto = false;
      try {
        const novo = await api.get<AtualizacaoDTO>('/atualizacao');
        if (!ativo) return;
        if (novo.disponivel) {
          deuCerto = true;
          setDados(novo);
          if (novo.tarefa.estado === 'EXECUTANDO') {
            vimosExecutando = true;
          } else if (vimosExecutando || Date.now() - inicio > TOLERANCIA_INICIO_MS) {
            setAcompanhando(null);
            setReiniciando(false);
            setErroAcompanhar(null);
            return;
          }
        }
      } catch {
        // Falha de rede ou 502/503/504: a API está reiniciando. Não é erro enquanto estiver no prazo.
      }
      if (!ativo) return;

      if (deuCerto) {
        falhasDesde = null;
        setReiniciando(false);
        setErroAcompanhar(null);
      } else {
        if (falhasDesde === null) falhasDesde = Date.now();
        if (Date.now() - falhasDesde >= LIMITE_FALHAS_MS) {
          setAcompanhando(null);
          setReiniciando(false);
          setErroAcompanhar(
            'Não foi possível confirmar o resultado da atualização. Recarregue a página para ver o estado atual.',
          );
          return;
        }
        setReiniciando(true);
      }
      timer = window.setTimeout(consultar, INTERVALO_CONSULTA_MS);
    }

    void consultar();
    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [acompanhando]);

  async function atualizar() {
    setConfirmando(false);
    setErroAcao(null);
    setEnviando(true);
    try {
      await api.post('/atualizacao');
      if (vivo.current) {
        setErroAcompanhar(null);
        setAcompanhando({ aguardarInicio: true });
      }
    } catch (e) {
      if (vivo.current) {
        setErroAcao(mensagemErro(e));
        // Pode ser "já existe uma atualização em andamento": relê o estado para acompanhar.
        void verificar();
      }
    } finally {
      if (vivo.current) setEnviando(false);
    }
  }

  const carregando = dados === null && erroCarga === null;
  const d = dados !== null && dados.disponivel ? dados : null;
  const emAndamento = d !== null && d.tarefa.estado === 'EXECUTANDO';
  const podeAtualizar =
    d !== null &&
    (d.atras > 0 || d.precisaReconstruir) &&
    !emAndamento &&
    acompanhando === null &&
    !enviando;

  return (
    <div className="config-atualizacao">
      <div className="config-atualizacao-topo">
        <p className="config-ajuda-campo">
          {d !== null && d.verificadoEm ? `Verificado em ${formatarDataHora(d.verificadoEm)}` : ''}
        </p>
        <Botao
          variante="secundario"
          desabilitado={verificando || acompanhando !== null}
          aoClicar={() => void verificar()}
        >
          {verificando ? 'Verificando...' : 'Verificar agora'}
        </Botao>
      </div>

      {erroCarga && <Aviso tipo="erro">{erroCarga}</Aviso>}
      {erroAcompanhar && <Aviso tipo="erro">{erroAcompanhar}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {carregando && <Carregando />}
      {dados !== null && !dados.disponivel && <Aviso tipo="info">{dados.motivo}</Aviso>}

      {d !== null && (
        <>
          {reiniciando && <Aviso tipo="info">Reiniciando o sistema...</Aviso>}
          {d.erroVerificacao && <div className="config-alerta" role="status">{d.erroVerificacao}</div>}
          {d.atualizadorMudou && (
            <div className="config-alerta" role="status">
              O serviço de atualização também mudou nesta versão. Para atualizá-lo, rode o instalador
              de novo na pasta do projeto.
            </div>
          )}

          <div className="config-atualizacao-cartoes">
            <Cartao titulo="Versão instalada">
              <Commit info={d.instalado} />
              <p className="config-ajuda-campo">Ramo: {d.ramo ?? '—'}</p>
              <p className="config-ajuda-campo">Repositório: {d.repositorio ?? '—'}</p>
            </Cartao>
            <Cartao titulo="Última versão no GitHub">
              <Commit info={d.remoto} />
              <div className="config-atualizacao-situacao">
                <SituacaoRemoto d={d} />
              </div>
              <div className="config-atualizacao-acoes">
                <Botao desabilitado={!podeAtualizar} aoClicar={() => setConfirmando(true)}>
                  {enviando ? 'Iniciando...' : 'Atualizar agora'}
                </Botao>
              </div>
            </Cartao>
          </div>

          <Cartao titulo="O que vem nesta atualização">
            {d.novidades.length === 0 ? (
              <p className="config-ajuda-campo">Nenhuma novidade pendente.</p>
            ) : (
              <ul className="config-novidades">
                {d.novidades.map((n) => (
                  <li key={n.curto} className="config-novidade">
                    <code className="config-commit-codigo">{n.curto}</code>
                    <span className="config-novidade-texto">{n.mensagem}</span>
                    <span className="config-ajuda-campo">{formatarDataHora(n.data)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {d.tarefa.estado !== 'PARADA' && <TarefaAtualizacao tarefa={d.tarefa} />}
        </>
      )}

      <Modal
        aberto={confirmando}
        titulo="Atualizar o sistema?"
        aoFechar={() => setConfirmando(false)}
      >
        <p>
          O sistema vai baixar a versão nova, reconstruir e reiniciar. Leva alguns minutos e as
          pessoas conectadas podem ser desconectadas por instantes.
        </p>
        <div className="config-atualizacao-acoes">
          <Botao variante="secundario" aoClicar={() => setConfirmando(false)}>
            Cancelar
          </Botao>
          <Botao aoClicar={() => void atualizar()}>Atualizar agora</Botao>
        </div>
      </Modal>
    </div>
  );
}
