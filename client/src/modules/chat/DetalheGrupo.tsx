import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../../lib/api';
import { Aviso, Avatar, Botao, Campo, Carregando, Modal, Selo } from '../../ui';
import { Icone } from '../../ui/icones';
import { mensagemErro, reduzirImagemChat } from './comum';
import type { ConversaDetalhe, PessoaChat } from './comum';

const INTERVALO_MEMBROS_MS = 5000;

interface PropsDetalhe {
  aberto: boolean;
  conversaId: number | null;
  souAdmin: boolean;
  eu: { id: number };
  aoFechar: () => void;
  aoSair: () => void;
  aoAlterar: () => void;
}

// Dados do grupo: foto, nome, membros (com presença), adicionar, remover e sair.
export function DetalheGrupo({ aberto, conversaId, souAdmin, eu, aoFechar, aoSair, aoAlterar }: PropsDetalhe) {
  const [detalhe, setDetalhe] = useState<ConversaDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Edição do nome e da foto (só administrador).
  const [editando, setEditando] = useState(false);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [fotoEdicao, setFotoEdicao] = useState<string | null | undefined>(undefined);
  const arquivoRef = useRef<HTMLInputElement>(null);

  // Adicionar pessoas.
  const [adicionando, setAdicionando] = useState(false);
  const [buscaAdd, setBuscaAdd] = useState('');
  const [contatosAdd, setContatosAdd] = useState<PessoaChat[]>([]);
  const [escolhidos, setEscolhidos] = useState<PessoaChat[]>([]);

  const [confirmarSair, setConfirmarSair] = useState(false);

  // Carrega os dados ao abrir e atualiza a presença a cada 5 s (pausa com a aba oculta).
  useEffect(() => {
    if (!aberto || conversaId === null) return;
    let cancelado = false;

    function carregar() {
      if (document.visibilityState === 'hidden') return;
      api
        .get<ConversaDetalhe>(`/chat/conversas/${conversaId}`)
        .then((r) => {
          if (cancelado) return;
          setDetalhe(r);
          setErro(null);
        })
        .catch((e) => {
          if (!cancelado) setErro(mensagemErro(e));
        })
        .finally(() => {
          if (!cancelado) setCarregando(false);
        });
    }

    setDetalhe(null);
    setCarregando(true);
    setEditando(false);
    setAdicionando(false);
    setConfirmarSair(false);
    carregar();
    const id = window.setInterval(carregar, INTERVALO_MEMBROS_MS);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, [aberto, conversaId]);

  // Busca de contatos para adicionar (com espera de 300 ms).
  useEffect(() => {
    if (!adicionando) return;
    let cancelado = false;
    const espera = window.setTimeout(() => {
      api
        .get<PessoaChat[]>(`/chat/contatos?busca=${encodeURIComponent(buscaAdd.trim())}`)
        .then((r) => {
          if (!cancelado) setContatosAdd(r);
        })
        .catch((e) => {
          if (!cancelado) setErro(mensagemErro(e));
        });
    }, 300);
    return () => {
      cancelado = true;
      window.clearTimeout(espera);
    };
  }, [adicionando, buscaAdd]);

  // Executa uma ação no servidor: mostra erro, recarrega e avisa a tela de cima.
  async function executar(acao: () => Promise<unknown>): Promise<boolean> {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      return true;
    } catch (e) {
      setErro(mensagemErro(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function recarregar() {
    if (conversaId === null) return;
    const r = await api.get<ConversaDetalhe>(`/chat/conversas/${conversaId}`);
    setDetalhe(r);
    aoAlterar();
  }

  function abrirEdicao() {
    setNomeEdicao(detalhe?.nome ?? '');
    setFotoEdicao(undefined);
    setEditando(true);
  }

  async function salvarEdicao() {
    if (conversaId === null) return;
    const nome = nomeEdicao.trim();
    if (nome.length < 2 || nome.length > 60) {
      setErro('O nome do grupo precisa ter de 2 a 60 caracteres.');
      return;
    }
    const corpo: { nome?: string; foto?: string | null } = { nome };
    if (fotoEdicao !== undefined) corpo.foto = fotoEdicao;
    const ok = await executar(() => api.put(`/chat/conversas/${conversaId}`, corpo));
    if (ok) {
      setEditando(false);
      await recarregar();
    }
  }

  async function escolherFoto(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    try {
      setFotoEdicao(await reduzirImagemChat(arquivo, 256));
    } catch (erroFoto) {
      setErro(mensagemErro(erroFoto));
    }
  }

  async function adicionarEscolhidos() {
    if (conversaId === null || escolhidos.length === 0) return;
    const ok = await executar(() =>
      api.post<ConversaDetalhe>(`/chat/conversas/${conversaId}/participantes`, {
        usuarioIds: escolhidos.map((p) => p.id),
      }),
    );
    if (ok) {
      setAdicionando(false);
      setEscolhidos([]);
      setBuscaAdd('');
      await recarregar();
    }
  }

  async function remover(pessoa: { id: number }) {
    if (conversaId === null) return;
    const ok = await executar(() => api.del(`/chat/conversas/${conversaId}/participantes/${pessoa.id}`));
    if (ok) await recarregar();
  }

  async function sair() {
    if (conversaId === null) return;
    const ok = await executar(() => api.del(`/chat/conversas/${conversaId}/participantes/${eu.id}`));
    if (ok) {
      setConfirmarSair(false);
      aoSair();
    }
  }

  // Quem já está no grupo não aparece na lista de adicionar.
  const idsMembros = new Set((detalhe?.membros ?? []).map((m) => m.id));
  const contatosDisponiveis = contatosAdd.filter((p) => !idsMembros.has(p.id));

  return (
    <Modal aberto={aberto} titulo="Dados do grupo" aoFechar={aoFechar}>
      {carregando && !detalhe && <Carregando />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {detalhe && !adicionando && (
        <div className="chat-detalhe">
          <div className="chat-detalhe-cabeca">
            <Avatar
              nome={detalhe.nome}
              foto={editando ? (fotoEdicao === undefined ? detalhe.foto : fotoEdicao) : detalhe.foto}
              tamanho={84}
            />
            {!editando ? (
              <>
                <h3 className="chat-detalhe-nome">{detalhe.nome}</h3>
                <p className="chat-detalhe-meta">{detalhe.membros.length} participantes</p>
                {souAdmin && (
                  <button type="button" className="chat-botao-texto" onClick={abrirEdicao}>
                    Editar nome e foto
                  </button>
                )}
              </>
            ) : (
              <div className="chat-detalhe-edicao">
                <Campo rotulo="Nome do grupo" valor={nomeEdicao} aoMudar={setNomeEdicao} obrigatorio />
                <div className="chat-grupo-foto-acoes">
                  <button
                    type="button"
                    className="chat-botao-texto"
                    onClick={() => arquivoRef.current?.click()}
                  >
                    Trocar foto
                  </button>
                  <button type="button" className="chat-botao-texto" onClick={() => setFotoEdicao(null)}>
                    Remover foto
                  </button>
                  <input
                    ref={arquivoRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={escolherFoto}
                  />
                </div>
                <div className="chat-acoes-modal">
                  <Botao variante="secundario" aoClicar={() => setEditando(false)}>
                    Cancelar
                  </Botao>
                  <Botao desabilitado={ocupado} aoClicar={salvarEdicao}>
                    Salvar
                  </Botao>
                </div>
              </div>
            )}
          </div>

          <h4 className="chat-detalhe-subtitulo">Participantes</h4>
          <ul className="chat-membros">
            {detalhe.membros.map((m) => (
              <li key={m.id} className="chat-membro">
                <span className="chat-avatar">
                  <Avatar nome={m.nome} foto={m.foto} tamanho={40} />
                  {m.online && <span className="chat-bolinha-online" aria-hidden="true" />}
                </span>
                <span className="chat-membro-texto">
                  <span className="chat-contato-nome">
                    {m.nome}
                    {m.id === eu.id ? ' (você)' : ''}
                  </span>
                  {m.admin && <Selo cor="azul">Administrador</Selo>}
                </span>
                {souAdmin && m.id !== eu.id && (
                  <button
                    type="button"
                    className="chat-botao-texto chat-botao-perigo"
                    disabled={ocupado}
                    onClick={() => remover(m)}
                    aria-label={`Remover ${m.nome} do grupo`}
                  >
                    <Icone nome="lixeira" tamanho={16} />
                    <span>Remover</span>
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="chat-detalhe-acoes">
            {souAdmin && (
              <Botao
                variante="secundario"
                aoClicar={() => setAdicionando(true)}
              >
                Adicionar pessoas
              </Botao>
            )}
            {!confirmarSair ? (
              <Botao variante="perigo" aoClicar={() => setConfirmarSair(true)}>
                Sair do grupo
              </Botao>
            ) : (
              <div className="chat-confirmar-sair">
                <p>Você deixa de receber as mensagens deste grupo.</p>
                <div className="chat-acoes-modal">
                  <Botao variante="secundario" aoClicar={() => setConfirmarSair(false)}>
                    Cancelar
                  </Botao>
                  <Botao variante="perigo" desabilitado={ocupado} aoClicar={sair}>
                    Sair
                  </Botao>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {detalhe && adicionando && (
        <div className="chat-detalhe">
          <h4 className="chat-detalhe-subtitulo">Adicionar pessoas</h4>
          <label className="campo">
            <span className="campo-rotulo">Buscar pessoa</span>
            <input
              className="campo-controle"
              type="search"
              value={buscaAdd}
              placeholder="Digite um nome"
              onChange={(e) => setBuscaAdd(e.target.value)}
            />
          </label>
          <ul className="chat-contatos">
            {contatosDisponiveis.map((p) => {
              const marcada = escolhidos.some((s) => s.id === p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={marcada ? 'chat-contato chat-contato-marcado' : 'chat-contato'}
                    aria-pressed={marcada}
                    onClick={() =>
                      setEscolhidos((atual) => {
                        if (atual.some((s) => s.id === p.id)) return atual.filter((s) => s.id !== p.id);
                        return [...atual, p];
                      })
                    }
                  >
                    <span className="chat-avatar">
                      <Avatar nome={p.nome} foto={p.foto} tamanho={40} />
                    </span>
                    <span className="chat-contato-texto">
                      <span className="chat-contato-nome">{p.nome}</span>
                    </span>
                    <span className="chat-marca" aria-hidden="true">
                      {marcada ? <Icone nome="visto" tamanho={16} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {contatosDisponiveis.length === 0 && (
            <p className="chat-vazio-texto">Nenhuma pessoa disponível para adicionar.</p>
          )}
          <div className="chat-acoes-modal">
            <Botao variante="secundario" aoClicar={() => setAdicionando(false)}>
              Voltar
            </Botao>
            <Botao desabilitado={ocupado || escolhidos.length === 0} aoClicar={adicionarEscolhidos}>
              Adicionar ({escolhidos.length})
            </Botao>
          </div>
        </div>
      )}
    </Modal>
  );
}
