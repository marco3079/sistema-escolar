import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { Avatar, Aviso, Botao, Carregando, Modal } from '../../ui';
import { Icone } from '../../ui/icones';
import { Mensagem } from './Mensagem';
import {
  LIMITE_TEXTO_MENSAGEM,
  chaveDoDia,
  citacaoDe,
  cortarTexto,
  ehDispositivoDeToque,
  estadoDaMensagem,
  mensagemErro,
  primeiroNome,
  reduzirImagemChat,
  rotuloDoDia,
} from './comum';
import type {
  CitacaoChat,
  ConversaChat,
  EnvioPendente,
  LeituraChat,
  MensagemTela,
} from './comum';

const INTERVALO_DIGITANDO_MS = 3000;
const TOLERANCIA_FIM_PX = 80;

interface PropsConversa {
  conversa: ConversaChat | null;
  eu: { id: number; nome: string };
  mensagens: MensagemTela[];
  haMais: boolean;
  carregandoMensagens: boolean;
  carregandoAnteriores: boolean;
  erro: string | null;
  digitando: string[];
  leitura: LeituraChat | null;
  online: boolean | null;
  aoVoltar: () => void;
  aoEnviar: (envio: EnvioPendente, citacao: CitacaoChat | null) => void;
  aoReenviar: (m: MensagemTela) => void;
  aoDescartar: (m: MensagemTela) => void;
  aoApagar: (m: MensagemTela) => Promise<void>;
  aoCarregarAnteriores: () => void;
  aoDigitar: () => void;
  aoAbrirDetalhe: () => void;
}

// Conversa aberta: cabeçalho, mensagens (com rolagem própria) e campo de envio.
export function Conversa({
  conversa,
  eu,
  mensagens,
  haMais,
  carregandoMensagens,
  carregandoAnteriores,
  erro,
  digitando,
  leitura,
  online,
  aoVoltar,
  aoEnviar,
  aoReenviar,
  aoDescartar,
  aoApagar,
  aoCarregarAnteriores,
  aoDigitar,
  aoAbrirDetalhe,
}: PropsConversa) {
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState<string | null>(null);
  const [processandoImagem, setProcessandoImagem] = useState(false);
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState<MensagemTela | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [confirmarApagar, setConfirmarApagar] = useState<MensagemTela | null>(null);
  const [novasAbaixo, setNovasAbaixo] = useState(0);
  const [destacadaId, setDestacadaId] = useState<number | null>(null);

  const listaRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  // Quando a pessoa está no fim da conversa, mensagens novas rolam sozinhas.
  const noFimRef = useRef(true);
  const primeiroRef = useRef<number | null>(null);
  const ultimoRef = useRef<number | null>(null);
  // Altura da lista antes de carregar mensagens anteriores (para manter a posição).
  const ajusteRef = useRef<number | null>(null);
  const ultimoDigitandoRef = useRef(0);
  const destaqueTimerRef = useRef<number | undefined>(undefined);

  const idConversa = conversa?.id ?? null;

  // Ao trocar de conversa: volta ao fim, limpa o rascunho e foca o campo (fora do celular).
  useLayoutEffect(() => {
    noFimRef.current = true;
    primeiroRef.current = null;
    ultimoRef.current = null;
    ajusteRef.current = null;
    setNovasAbaixo(0);
    setTexto('');
    setImagem(null);
    setErroCampo(null);
    setRespondendo(null);
    setMenuId(null);
    setDestacadaId(null);
  }, [idConversa]);

  useEffect(() => {
    if (idConversa !== null && !ehDispositivoDeToque()) campoRef.current?.focus();
  }, [idConversa]);

  // Rolagem: ajusta ao carregar anteriores, rola ao fim quando chega mensagem (se a pessoa já estava lá)
  // ou mostra o botão "Novas mensagens".
  useLayoutEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const primeiro = mensagens[0]?.id ?? null;
    const ultimo = mensagens[mensagens.length - 1]?.id ?? null;

    if (ajusteRef.current !== null && primeiro !== primeiroRef.current) {
      lista.scrollTop += lista.scrollHeight - ajusteRef.current;
      ajusteRef.current = null;
    } else if (ultimo !== ultimoRef.current && ultimo !== null) {
      const ultimaMinha = mensagens[mensagens.length - 1]?.minha ?? false;
      if (noFimRef.current || ultimaMinha) {
        lista.scrollTop = lista.scrollHeight;
        noFimRef.current = true;
        setNovasAbaixo(0);
      } else {
        setNovasAbaixo((n) => n + 1);
      }
    }
    primeiroRef.current = primeiro;
    ultimoRef.current = ultimo;
  }, [mensagens]);

  // Campo de texto cresce com o conteúdo (até o limite do CSS, com rolagem depois).
  useLayoutEffect(() => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.style.height = 'auto';
    campo.style.height = `${campo.scrollHeight}px`;
  }, [texto]);

  useEffect(() => {
    return () => window.clearTimeout(destaqueTimerRef.current);
  }, []);

  function aoRolar() {
    const lista = listaRef.current;
    if (!lista) return;
    const noFim = lista.scrollHeight - lista.scrollTop - lista.clientHeight < TOLERANCIA_FIM_PX;
    noFimRef.current = noFim;
    if (noFim) setNovasAbaixo(0);
  }

  function irParaFim() {
    const lista = listaRef.current;
    if (!lista) return;
    lista.scrollTop = lista.scrollHeight;
    noFimRef.current = true;
    setNovasAbaixo(0);
  }

  // Imagem recarregada (ou carregada depois) muda a altura: mantém o fim visível.
  function aoCarregarImagem() {
    if (noFimRef.current) irParaFim();
  }

  function irParaMensagem(id: number) {
    const lista = listaRef.current;
    const alvo = lista?.querySelector<HTMLElement>(`[data-mensagem-id="${id}"]`);
    if (!alvo) return;
    alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setDestacadaId(id);
    window.clearTimeout(destaqueTimerRef.current);
    destaqueTimerRef.current = window.setTimeout(() => setDestacadaId(null), 1500);
  }

  function aoMudarTexto(valor: string) {
    setTexto(valor);
    if (valor.trim() !== '' && Date.now() - ultimoDigitandoRef.current > INTERVALO_DIGITANDO_MS) {
      ultimoDigitandoRef.current = Date.now();
      aoDigitar();
    }
  }

  function enviar() {
    if (processandoImagem) return;
    const limpo = texto.trim();
    if (limpo === '' && imagem === null) return;
    if (limpo.length > LIMITE_TEXTO_MENSAGEM) {
      setErroCampo(`A mensagem passa de ${LIMITE_TEXTO_MENSAGEM.toLocaleString('pt-BR')} caracteres.`);
      return;
    }
    const citacao = respondendo ? citacaoDe(respondendo) : null;
    aoEnviar(
      {
        status: 'enviando',
        texto: limpo,
        imagem,
        respostaAId: respondendo?.id ?? null,
      },
      citacao,
    );
    noFimRef.current = true;
    setTexto('');
    setImagem(null);
    setRespondendo(null);
    setErroCampo(null);
    ultimoDigitandoRef.current = 0;
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    // No celular, Enter quebra linha e o botão envia.
    if (ehDispositivoDeToque()) return;
    e.preventDefault();
    enviar();
  }

  async function aoEscolherImagem(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErroCampo(null);
    setProcessandoImagem(true);
    try {
      setImagem(await reduzirImagemChat(arquivo, 1280));
    } catch (erroImagem) {
      setErroCampo(mensagemErro(erroImagem));
    } finally {
      setProcessandoImagem(false);
    }
  }

  function carregarAnteriores() {
    ajusteRef.current = listaRef.current?.scrollHeight ?? null;
    aoCarregarAnteriores();
  }

  async function confirmarApagarAgora() {
    const alvo = confirmarApagar;
    setConfirmarApagar(null);
    if (!alvo) return;
    try {
      await aoApagar(alvo);
    } catch (erroApagar) {
      setErroCampo(mensagemErro(erroApagar));
    }
  }

  const estaDigitando = digitando.length > 0;
  const podeEnviar = !processandoImagem && (texto.trim() !== '' || imagem !== null);
  const ehGrupo = conversa?.tipo === 'GRUPO';

  // Mensagens com separador de dia e nome do autor (em grupo, só no primeiro balão de cada sequência).
  const itens: ReactNode[] = [];
  let diaAnterior = '';
  let autorAnterior: number | null = null;
  for (const m of mensagens) {
    const dia = chaveDoDia(m.criadaEm);
    if (dia !== diaAnterior) {
      itens.push(
        <div key={`dia-${m.id}`} className="chat-separador-dia">
          <span>{rotuloDoDia(m.criadaEm)}</span>
        </div>,
      );
      diaAnterior = dia;
      autorAnterior = null;
    }
    const mostrarNome = ehGrupo && !m.minha && !m.sistema && autorAnterior !== m.autor.id;
    itens.push(
      <Mensagem
        key={m.id}
        m={m}
        estado={m.minha ? estadoDaMensagem(m, leitura) : null}
        mostrarNome={mostrarNome}
        destacada={destacadaId === m.id}
        menuAberto={menuId === m.id}
        aoAlternarMenu={() => setMenuId((atual) => (atual === m.id ? null : m.id))}
        aoResponder={() => {
          setRespondendo(m);
          setMenuId(null);
          campoRef.current?.focus();
        }}
        aoApagar={() => {
          setMenuId(null);
          setConfirmarApagar(m);
        }}
        aoReenviar={() => aoReenviar(m)}
        aoDescartar={() => aoDescartar(m)}
        aoIrParaCitacao={irParaMensagem}
        aoAmpliar={setAmpliada}
        aoCarregarImagem={aoCarregarImagem}
      />,
    );
    autorAnterior = m.sistema ? null : m.autor.id;
  }

  let situacao: string | null = null;
  if (conversa) {
    if (estaDigitando) situacao = 'digitando...';
    else if (ehGrupo) situacao = `${conversa.participantes} participantes`;
    else if (online) situacao = 'online';
  }

  const cabecalhoPessoa = conversa ? (
    <>
      <span className="chat-avatar">
        <Avatar nome={conversa.nome} foto={conversa.foto} tamanho={42} />
        {!ehGrupo && online && <span className="chat-bolinha-online" aria-hidden="true" />}
      </span>
      <span className="chat-topo-textos">
        <span className="chat-topo-nome">{conversa.nome}</span>
        {situacao && (
          <span className={estaDigitando ? 'chat-topo-status chat-digitando' : 'chat-topo-status'}>
            {situacao}
          </span>
        )}
      </span>
    </>
  ) : (
    <span className="chat-topo-textos">
      <span className="chat-topo-nome">Carregando...</span>
    </span>
  );

  return (
    <section className="chat-conversa" aria-label={conversa ? `Conversa com ${conversa.nome}` : 'Conversa'}>
      <header className="chat-conversa-topo">
        <button
          type="button"
          className="chat-botao-redondo chat-botao-voltar"
          aria-label="Voltar para as conversas"
          onClick={aoVoltar}
        >
          <Icone nome="seta-esquerda" tamanho={20} />
        </button>
        {ehGrupo ? (
          <button
            type="button"
            className="chat-topo-pessoa chat-topo-clicavel"
            onClick={aoAbrirDetalhe}
            aria-label="Ver dados do grupo"
          >
            {cabecalhoPessoa}
          </button>
        ) : (
          <div className="chat-topo-pessoa">{cabecalhoPessoa}</div>
        )}
      </header>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="chat-mensagens-area">
        <div
          ref={listaRef}
          className="chat-mensagens"
          onScroll={aoRolar}
          aria-live="polite"
          aria-relevant="additions"
        >
          {haMais && (
            <div className="chat-anteriores">
              <button
                type="button"
                className="chat-botao-texto"
                onClick={carregarAnteriores}
                disabled={carregandoAnteriores}
              >
                {carregandoAnteriores ? 'Carregando...' : 'Carregar anteriores'}
              </button>
            </div>
          )}
          {carregandoMensagens && mensagens.length === 0 && <Carregando />}
          {!carregandoMensagens && mensagens.length === 0 && conversa && !erro && (
            <p className="chat-vazio-conversa">Diga olá para começar a conversa.</p>
          )}
          {itens}
        </div>
        {novasAbaixo > 0 && (
          <button type="button" className="chat-novas" onClick={irParaFim}>
            Novas mensagens
          </button>
        )}
      </div>

      <footer className="chat-composer">
        {respondendo && (
          <div className="chat-respondendo">
            <Icone nome="responder" tamanho={18} />
            <div className="chat-respondendo-texto">
              <strong>Respondendo a {respondendo.autor.id === eu.id ? 'você' : primeiroNome(respondendo.autor.nome)}</strong>
              <span>
                {respondendo.apagada
                  ? 'Mensagem apagada'
                  : cortarTexto(respondendo.texto, 120) || (respondendo.imagem ? 'Foto' : '')}
              </span>
            </div>
            <button
              type="button"
              className="chat-botao-icone"
              aria-label="Cancelar resposta"
              onClick={() => setRespondendo(null)}
            >
              <Icone nome="fechar" tamanho={18} />
            </button>
          </div>
        )}

        {imagem && (
          <div className="chat-previa-imagem">
            <img src={imagem} alt="Prévia da imagem" />
            <button
              type="button"
              className="chat-botao-icone"
              aria-label="Remover imagem"
              onClick={() => setImagem(null)}
            >
              <Icone nome="fechar" tamanho={18} />
            </button>
          </div>
        )}

        {processandoImagem && <p className="chat-processando">Preparando imagem...</p>}
        {erroCampo && <p className="chat-erro-campo" role="alert">{erroCampo}</p>}

        <div className="chat-composer-linha">
          <button
            type="button"
            className="chat-botao-redondo"
            aria-label="Anexar imagem"
            disabled={processandoImagem}
            onClick={() => arquivoRef.current?.click()}
          >
            <Icone nome="imagem" tamanho={20} />
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={aoEscolherImagem}
          />
          <textarea
            ref={campoRef}
            className="chat-campo"
            rows={1}
            value={texto}
            placeholder="Escreva uma mensagem"
            aria-label="Mensagem"
            onChange={(e) => aoMudarTexto(e.target.value)}
            onKeyDown={aoTeclar}
          />
          <button
            type="button"
            className="chat-botao-enviar"
            aria-label="Enviar mensagem"
            disabled={!podeEnviar}
            onClick={enviar}
          >
            <Icone nome="enviar" tamanho={20} />
          </button>
        </div>
      </footer>

      <Modal aberto={ampliada !== null} titulo="Imagem" aoFechar={() => setAmpliada(null)}>
        {ampliada && <img className="chat-imagem-ampliada" src={ampliada} alt="Imagem ampliada" />}
      </Modal>

      <Modal
        aberto={confirmarApagar !== null}
        titulo="Apagar mensagem"
        aoFechar={() => setConfirmarApagar(null)}
      >
        <p className="chat-texto-modal">
          A mensagem será apagada para todos os participantes da conversa.
        </p>
        <div className="chat-acoes-modal">
          <Botao variante="secundario" aoClicar={() => setConfirmarApagar(null)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" aoClicar={confirmarApagarAgora}>
            Apagar
          </Botao>
        </div>
      </Modal>
    </section>
  );
}
