import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, Aviso, Botao, Carregando, Modal, Selecao, formatarData } from '../../ui';
import { Icone } from '../../ui/icones';
import {
  EtapasChamado,
  PRIORIDADES,
  SeloCategoria,
  SeloPrioridade,
  SeloStatus,
  formatarHora,
  mensagemErro,
  CampoAnexo,
} from './comum';
import type { ChamadoDetalhe } from './comum';

const INTERVALO_ATUALIZACAO = 8000;
function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="suporte-estrelas" role="img" aria-label={`Avaliação: ${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= nota ? 'suporte-estrela suporte-estrela-cheia' : 'suporte-estrela'}>
          <Icone nome="estrela" tamanho={16} />
        </span>
      ))}
    </span>
  );
}

export function Conversa({ chamadoId, aoMudar }: { chamadoId: number; aoMudar: () => void }) {
  const { usuario } = useAuth();
  const [chamado, setChamado] = useState<ChamadoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [texto, setTexto] = useState('');
  const [anexo, setAnexo] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<string | null>(null);

  const [modalEncerrar, setModalEncerrar] = useState(false);
  const [nota, setNota] = useState<number | null>(null);
  const [comentarioFim, setComentarioFim] = useState('');

  const listaRef = useRef<HTMLUListElement>(null);
  // Chamado que está na tela agora: respostas atrasadas de outro chamado são descartadas.
  const idAtual = useRef(chamadoId);

  const carregar = useCallback(async () => {
    const alvo = chamadoId;
    try {
      const dados = await api.get<ChamadoDetalhe>(`/chamados/${alvo}`);
      if (alvo === idAtual.current) {
        setChamado(dados);
        setErro(null);
      }
    } catch (e) {
      if (alvo === idAtual.current) setErro(mensagemErro(e));
    } finally {
      if (alvo === idAtual.current) setCarregando(false);
    }
  }, [chamadoId]);

  // Carrega ao abrir e atualiza a cada 8 s; o intervalo para com a aba oculta e recomeça ao voltar.
  useEffect(() => {
    idAtual.current = chamadoId;
    setChamado(null);
    setCarregando(true);
    setErro(null);
    setErroAcao(null);
    setTexto('');
    setAnexo(null);
    setModalEncerrar(false);
    carregar();

    let timer: number | undefined;
    function parar() {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    }
    function iniciar() {
      parar();
      timer = window.setInterval(carregar, INTERVALO_ATUALIZACAO);
    }
    function aoMudarVisibilidade() {
      if (document.hidden) {
        parar();
      } else {
        carregar();
        iniciar();
      }
    }
    if (!document.hidden) iniciar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      parar();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [chamadoId, carregar]);

  // Rola até a última mensagem ao abrir e quando chega mensagem nova.
  const idChamado = chamado?.id;
  const quantidade = chamado?.mensagens.length ?? 0;
  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [idChamado, quantidade]);

  // Executa uma ação no servidor, recarrega o chamado e avisa a tela de cima.
  async function executar(acao: () => Promise<unknown>): Promise<boolean> {
    setOcupado(true);
    setErroAcao(null);
    try {
      await acao();
      await carregar();
      aoMudar();
      return true;
    } catch (e) {
      setErroAcao(mensagemErro(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function enviar(aguardarUsuario: boolean) {
    const limpo = texto.trim();
    if (!chamado || limpo === '' || ocupado) return;
    const ok = await executar(() =>
      api.post(`/chamados/${chamado.id}/mensagens`, {
        texto: limpo,
        anexo: anexo ?? undefined,
        aguardarUsuario,
      }),
    );
    if (ok) {
      setTexto('');
      setAnexo(null);
    }
  }

  function aoTeclarNaResposta(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      enviar(false);
    }
  }

  async function encerrar() {
    if (!chamado) return;
    const comentario = comentarioFim.trim();
    const ok = await executar(() =>
      api.post(`/chamados/${chamado.id}/encerrar`, {
        avaliacao: nota ?? undefined,
        comentario: comentario === '' ? undefined : comentario,
      }),
    );
    if (ok) {
      setModalEncerrar(false);
      setNota(null);
      setComentarioFim('');
    }
  }

  if (carregando && !chamado) {
    return <Carregando />;
  }
  if (!chamado) {
    return <Aviso tipo="erro">{erro ?? 'Não foi possível abrir o chamado.'}</Aviso>;
  }

  const souEu = (id: number) => usuario?.id === id;
  const souAutor = usuario?.id === chamado.autor.id;
  const fechado = chamado.status === 'FECHADO';

  return (
    <article className="suporte-conversa">
      <header className="suporte-conversa-cabecalho">
        <div className="suporte-conversa-titulo">
          <span className="suporte-numero">#{chamado.id}</span>
          <h3>{chamado.assunto}</h3>
        </div>
        <div className="suporte-selos">
          <SeloCategoria categoria={chamado.categoria} />
          <SeloPrioridade prioridade={chamado.prioridade} />
          <SeloStatus status={chamado.status} souEquipe={chamado.souEquipe} />
        </div>
        <p className="suporte-meta">
          {chamado.turma && <>Turma {chamado.turma.codigo} · {chamado.turma.disciplina} · </>}
          Aberto em {formatarData(chamado.criadoEm)} por {chamado.autor.nome}
        </p>
        <p className="suporte-meta">
          Responsável:{' '}
          {chamado.responsavel ? chamado.responsavel.nome : 'Ainda sem responsável'}
        </p>
        <EtapasChamado status={chamado.status} />
      </header>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <ul className="suporte-mensagens" ref={listaRef} aria-label="Mensagens">
        {chamado.mensagens.map((m) => {
          const eu = souEu(m.autor.id);
          return (
            <li key={m.id} className={eu ? 'suporte-linha suporte-linha-eu' : 'suporte-linha'}>
              {!eu && <Avatar nome={m.autor.nome} foto={m.autor.foto} tamanho={32} />}
              <div className="suporte-balao-bloco">
                <p className="suporte-balao-cabecalho">
                  <span className="suporte-balao-nome">{eu ? 'Você' : m.autor.nome}</span>
                  {m.daEquipe && <span className="suporte-selo-equipe">Equipe</span>}
                </p>
                <div className={eu ? 'suporte-balao suporte-balao-eu' : 'suporte-balao suporte-balao-outro'}>
                  {m.texto && <p className="suporte-balao-texto">{m.texto}</p>}
                  {m.anexo && (
                    <button
                      type="button"
                      className="suporte-anexo-miniatura"
                      aria-label="Ampliar imagem anexada"
                      onClick={() => setAmpliada(m.anexo)}
                    >
                      <img src={m.anexo} alt="" loading="lazy" />
                    </button>
                  )}
                </div>
                <time className="suporte-balao-hora" dateTime={m.criadoEm}>
                  {formatarHora(m.criadoEm)}
                </time>
              </div>
              {eu && <Avatar nome={m.autor.nome} foto={m.autor.foto} tamanho={32} />}
            </li>
          );
        })}
      </ul>

      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}

      {chamado.souEquipe && !fechado && (
        <div className="suporte-acoes">
          {chamado.responsavel?.id !== usuario?.id && (
            <Botao
              variante="secundario"
              desabilitado={ocupado}
              aoClicar={() => executar(() => api.post(`/chamados/${chamado.id}/assumir`))}
            >
              Assumir
            </Botao>
          )}
          {chamado.status !== 'RESOLVIDO' && (
            <Botao
              variante="secundario"
              desabilitado={ocupado}
              aoClicar={() =>
                executar(() => api.put(`/chamados/${chamado.id}`, { status: 'RESOLVIDO' }))
              }
            >
              Marcar como resolvido
            </Botao>
          )}
          <div className="suporte-acao-prioridade">
            <Selecao
              rotulo="Prioridade"
              valor={chamado.prioridade}
              opcoes={PRIORIDADES}
              aoMudar={(valor) => {
                if (valor !== chamado.prioridade) {
                  executar(() => api.put(`/chamados/${chamado.id}`, { prioridade: valor }));
                }
              }}
            />
          </div>
        </div>
      )}

      {souAutor && (
        <div className="suporte-acoes">
          {(chamado.status === 'RESOLVIDO' || fechado) && (
            <Botao
              variante="secundario"
              desabilitado={ocupado}
              aoClicar={() => executar(() => api.post(`/chamados/${chamado.id}/reabrir`))}
            >
              Reabrir
            </Botao>
          )}
          {!fechado && (
            <Botao variante="secundario" desabilitado={ocupado} aoClicar={() => setModalEncerrar(true)}>
              Encerrar chamado
            </Botao>
          )}
        </div>
      )}

      {fechado ? (
        <div className="suporte-encerrado">
          <p>Este chamado está encerrado.</p>
          {chamado.avaliacao !== null && (
            <>
              <Estrelas nota={chamado.avaliacao} />
              {chamado.avaliacaoComentario && (
                <p className="suporte-avaliacao-comentario">{chamado.avaliacaoComentario}</p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="suporte-resposta">
          <label className="campo">
            <span className="campo-rotulo">Mensagem</span>
            <textarea
              className="campo-controle"
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={aoTeclarNaResposta}
            />
          </label>
          <CampoAnexo valor={anexo} aoMudar={setAnexo} ocupado={ocupado} />
          <div className="suporte-resposta-barra">
            <div className="suporte-resposta-enviar">
              {chamado.souEquipe && (
                <Botao
                  variante="secundario"
                  desabilitado={texto.trim() === '' || ocupado}
                  aoClicar={() => enviar(true)}
                >
                  Pedir mais informações
                </Botao>
              )}
              <Botao
                desabilitado={texto.trim() === '' || ocupado}
                aoClicar={() => enviar(false)}
              >
                <Icone nome="enviar" tamanho={18} />
                Enviar
              </Botao>
            </div>
          </div>
        </div>
      )}

      <Modal aberto={ampliada !== null} titulo="Imagem anexada" aoFechar={() => setAmpliada(null)}>
        {ampliada && <img className="suporte-anexo-ampliado" src={ampliada} alt="Imagem anexada" />}
      </Modal>

      <Modal
        aberto={modalEncerrar}
        titulo="Encerrar chamado"
        aoFechar={() => setModalEncerrar(false)}
      >
        <div className="suporte-encerrar">
          <p>Como foi o atendimento? A avaliação é opcional.</p>
          <div className="suporte-estrelas-escolha" role="radiogroup" aria-label="Nota de 1 a 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={nota === n}
                aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                className={
                  nota !== null && n <= nota
                    ? 'suporte-estrela-botao suporte-estrela-botao-cheia'
                    : 'suporte-estrela-botao'
                }
                onClick={() => setNota(n)}
              >
                <Icone nome="estrela" tamanho={28} />
              </button>
            ))}
          </div>
          <label className="campo">
            <span className="campo-rotulo">Comentário (opcional)</span>
            <textarea
              className="campo-controle"
              rows={3}
              maxLength={500}
              value={comentarioFim}
              onChange={(e) => setComentarioFim(e.target.value)}
            />
          </label>
          {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
          <div className="suporte-encerrar-acoes">
            <Botao variante="secundario" aoClicar={() => setModalEncerrar(false)}>
              Cancelar
            </Botao>
            <Botao desabilitado={ocupado} aoClicar={encerrar}>
              Encerrar chamado
            </Botao>
          </div>
        </div>
      </Modal>
    </article>
  );
}
