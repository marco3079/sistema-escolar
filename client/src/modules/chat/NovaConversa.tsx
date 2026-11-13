import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../../lib/api';
import { Abas, Aviso, Avatar, Botao, Campo, Modal } from '../../ui';
import { Icone } from '../../ui/icones';
import { LIMITE_GRUPO_PARTICIPANTES, mensagemErro, reduzirImagemChat } from './comum';
import type { PessoaChat } from './comum';

const ROTULO_PERFIL: Record<string, string> = {
  ADMIN: 'Administrador',
  TI: 'TI',
  SECRETARIA: 'Secretaria',
  PROFESSOR: 'Professor',
  ALUNO: 'Aluno',
  RESPONSAVEL: 'Responsável',
};

interface PropsNovaConversa {
  aberto: boolean;
  aoFechar: () => void;
  aoCriada: (id: number) => void;
}

// Busca de contatos (GET /chat/contatos) com espera de 300 ms depois da última tecla.
function useContatos(aberto: boolean, busca: string) {
  const [termo, setTermo] = useState('');
  const [contatos, setContatos] = useState<PessoaChat[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const espera = window.setTimeout(() => setTermo(busca.trim()), 300);
    return () => window.clearTimeout(espera);
  }, [busca]);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setCarregando(true);
    api
      .get<PessoaChat[]>(`/chat/contatos?busca=${encodeURIComponent(termo)}`)
      .then((r) => {
        if (cancelado) return;
        setContatos(r);
        setErro(null);
      })
      .catch((e) => {
        if (!cancelado) setErro(mensagemErro(e));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [aberto, termo]);

  return { contatos, carregando, erro };
}

// Modal "Nova conversa": conversa individual (tocar numa pessoa) ou grupo (várias pessoas e um nome).
export function NovaConversa({ aberto, aoFechar, aoCriada }: PropsNovaConversa) {
  const [aba, setAba] = useState<'individual' | 'grupo'>('individual');
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<PessoaChat[]>([]);
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [fotoGrupo, setFotoGrupo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const { contatos, carregando, erro: erroContatos } = useContatos(aberto, busca);

  // Ao abrir, começa do zero.
  useEffect(() => {
    if (!aberto) return;
    setAba('individual');
    setBusca('');
    setSelecionados([]);
    setNomeGrupo('');
    setFotoGrupo(null);
    setErro(null);
  }, [aberto]);

  async function criarIndividual(pessoa: PessoaChat) {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await api.post<{ id: number }>('/chat/conversas', {
        tipo: 'INDIVIDUAL',
        usuarioId: pessoa.id,
      });
      aoCriada(resposta.id);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  function alternarSelecao(pessoa: PessoaChat) {
    setSelecionados((atual) => {
      if (atual.some((p) => p.id === pessoa.id)) return atual.filter((p) => p.id !== pessoa.id);
      if (atual.length >= LIMITE_GRUPO_PARTICIPANTES) return atual;
      return [...atual, pessoa];
    });
  }

  async function escolherFoto(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    try {
      setFotoGrupo(await reduzirImagemChat(arquivo, 256));
    } catch (erroFoto) {
      setErro(mensagemErro(erroFoto));
    }
  }

  const nomeValido = nomeGrupo.trim().length >= 2 && nomeGrupo.trim().length <= 60;
  const podeCriarGrupo = nomeValido && selecionados.length >= 1 && !ocupado;

  async function criarGrupo() {
    if (!podeCriarGrupo) return;
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await api.post<{ id: number }>('/chat/conversas', {
        tipo: 'GRUPO',
        nome: nomeGrupo.trim(),
        participantes: selecionados.map((p) => p.id),
        foto: fotoGrupo ?? undefined,
      });
      aoCriada(resposta.id);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const mostrarErro = erro ?? erroContatos;

  return (
    <Modal aberto={aberto} titulo="Nova conversa" aoFechar={aoFechar}>
      <div className="chat-nova">
        <Abas
          abas={[
            { id: 'individual', rotulo: 'Conversa' },
            { id: 'grupo', rotulo: 'Novo grupo' },
          ]}
          ativa={aba}
          aoMudar={(id) => setAba(id as 'individual' | 'grupo')}
        />

        {aba === 'grupo' && (
          <div className="chat-grupo-formulario">
            <div className="chat-grupo-foto-linha">
              <Avatar nome={nomeGrupo || 'Grupo'} foto={fotoGrupo} tamanho={56} />
              <div className="chat-grupo-foto-acoes">
                <button
                  type="button"
                  className="chat-botao-texto"
                  onClick={() => arquivoRef.current?.click()}
                >
                  {fotoGrupo ? 'Trocar foto' : 'Foto do grupo (opcional)'}
                </button>
                {fotoGrupo && (
                  <button type="button" className="chat-botao-texto" onClick={() => setFotoGrupo(null)}>
                    Remover foto
                  </button>
                )}
                <input
                  ref={arquivoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={escolherFoto}
                />
              </div>
            </div>
            <Campo rotulo="Nome do grupo" valor={nomeGrupo} aoMudar={setNomeGrupo} obrigatorio />
            {selecionados.length > 0 && (
              <ul className="chat-chips" aria-label="Pessoas escolhidas">
                {selecionados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="chat-chip"
                      onClick={() => alternarSelecao(p)}
                      aria-label={`Remover ${p.nome} da seleção`}
                    >
                      <span>{p.nome}</span>
                      <Icone nome="fechar" tamanho={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <label className="campo">
          <span className="campo-rotulo">
            {aba === 'grupo' ? 'Adicionar pessoas' : 'Buscar pessoa'}
          </span>
          <input
            className="campo-controle"
            type="search"
            value={busca}
            placeholder="Digite um nome"
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>

        {mostrarErro && <Aviso tipo="erro">{mostrarErro}</Aviso>}

        {carregando && contatos.length === 0 && <p className="chat-vazio-texto">Buscando...</p>}
        {!carregando && contatos.length === 0 && !mostrarErro && (
          <p className="chat-vazio-texto">Nenhuma pessoa encontrada.</p>
        )}

        <ul className="chat-contatos">
          {contatos.map((p) => {
            const marcada = selecionados.some((s) => s.id === p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={marcada ? 'chat-contato chat-contato-marcado' : 'chat-contato'}
                  aria-pressed={aba === 'grupo' ? marcada : undefined}
                  disabled={ocupado}
                  onClick={() => (aba === 'grupo' ? alternarSelecao(p) : criarIndividual(p))}
                >
                  <span className="chat-avatar">
                    <Avatar nome={p.nome} foto={p.foto} tamanho={40} />
                    {p.online && <span className="chat-bolinha-online" aria-hidden="true" />}
                  </span>
                  <span className="chat-contato-texto">
                    <span className="chat-contato-nome">{p.nome}</span>
                    <span className="chat-contato-perfil">{ROTULO_PERFIL[p.perfil] ?? p.perfil}</span>
                  </span>
                  {aba === 'grupo' && (
                    <span className="chat-marca" aria-hidden="true">
                      {marcada ? <Icone nome="visto" tamanho={16} /> : null}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {aba === 'grupo' && (
          <div className="chat-acoes-modal">
            <span className="chat-contagem">
              {selecionados.length} de {LIMITE_GRUPO_PARTICIPANTES} escolhidas
            </span>
            <Botao desabilitado={!podeCriarGrupo} aoClicar={criarGrupo}>
              Criar grupo
            </Botao>
          </div>
        )}
      </div>
    </Modal>
  );
}
