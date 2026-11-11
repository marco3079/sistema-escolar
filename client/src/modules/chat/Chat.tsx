import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Icone } from '../../ui/icones';
import { Conversa } from './Conversa';
import { DetalheGrupo } from './DetalheGrupo';
import { ListaConversas } from './ListaConversas';
import { NovaConversa } from './NovaConversa';
import {
  PAGINA_MENSAGENS,
  mensagemErro,
  mesclarConversas,
  mesclarMensagens,
  mesclarRecebidas,
} from './comum';
import type {
  CitacaoChat,
  ConversaChat,
  EnvioPendente,
  LeituraChat,
  MensagemChat,
  MensagemTela,
  PaginaMensagensChat,
  Sincronizacao,
} from './comum';
import './chat.css';

// Intervalos da consulta de sincronização: mais rápido com uma conversa aberta.
const INTERVALO_COM_CONVERSA_MS = 2000;
const INTERVALO_SEM_CONVERSA_MS = 5000;

// Marca as mensagens da conversa como lidas (sem esperar resposta).
function marcarLida(conversaId: number): void {
  api.post(`/chat/conversas/${conversaId}/lida`).catch(() => undefined);
}

// Tela do chat privado: lista de conversas à esquerda e a conversa aberta à direita.
// Uma única consulta periódica (GET /chat/sincronizar) atualiza tudo. Pausa com a aba oculta.
export function Chat() {
  const { usuario } = useAuth();
  const eu = useMemo(() => ({ id: usuario?.id ?? 0, nome: usuario?.nome ?? '' }), [usuario?.id, usuario?.nome]);

  const [conversas, setConversas] = useState<ConversaChat[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const [abertaId, setAbertaId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<MensagemTela[]>([]);
  const [haMais, setHaMais] = useState(false);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false);
  const [digitando, setDigitando] = useState<string[]>([]);
  const [leitura, setLeitura] = useState<LeituraChat | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [erroConversa, setErroConversa] = useState<string | null>(null);

  const [novaAberta, setNovaAberta] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);

  // Estado que o ciclo de sincronização lê sem depender da renderização.
  const abertaRef = useRef<number | null>(null);
  // "agora" da última sincronização; null = próxima consulta traz tudo.
  const cursorRef = useRef<string | null>(null);
  // Muda ao trocar de conversa: respostas atrasadas da conversa anterior são descartadas.
  const geracaoRef = useRef(0);
  const contadorTempRef = useRef(0);

  // Sincronização: desde a última (ou tudo, na primeira vez e depois de trocar de conversa).
  const sincronizar = useCallback(async (completa = false): Promise<void> => {
    const geracao = geracaoRef.current;
    const alvo = abertaRef.current;
    const semDesde = completa || cursorRef.current === null;
    const partes: string[] = [];
    if (!semDesde && cursorRef.current) partes.push(`desde=${encodeURIComponent(cursorRef.current)}`);
    if (alvo !== null) partes.push(`conversaId=${alvo}`);
    const consulta = partes.length > 0 ? `?${partes.join('&')}` : '';

    const r = await api.get<Sincronizacao>(`/chat/sincronizar${consulta}`);
    if (geracao !== geracaoRef.current) return;

    cursorRef.current = r.agora;
    setErroLista(null);
    setCarregandoLista(false);
    setConversas((atual) => mesclarConversas(semDesde ? [] : atual, r.conversas));

    if (alvo === null) return;
    if (r.aberta === null) {
      // Deixei de ser participante desta conversa: fecha a tela.
      abertaRef.current = null;
      geracaoRef.current += 1;
      cursorRef.current = null;
      setAbertaId(null);
      setMensagens([]);
      setDigitando([]);
      setLeitura(null);
      setOnline(null);
      setHaMais(false);
      setErroConversa(null);
      setDetalheAberto(false);
      return;
    }

    setDigitando(r.aberta.digitando);
    setLeitura(r.aberta.leitura);
    setOnline(r.aberta.online);
    if (!semDesde && r.aberta.mensagens.length > 0) {
      setMensagens((atual) => mesclarRecebidas(atual, r.aberta?.mensagens ?? []));
      if (r.aberta.mensagens.some((m) => !m.minha) && document.visibilityState !== 'hidden') {
        marcarLida(alvo);
      }
    }
  }, []);

  // Ciclo de consulta: uma única fila de tempo; pausa com a aba oculta e retoma na hora ao voltar.
  useEffect(() => {
    let timer: number | undefined;
    let cancelado = false;
    let emVoo = false;

    async function ciclo(): Promise<void> {
      if (cancelado) return;
      window.clearTimeout(timer);
      if (document.visibilityState !== 'hidden' && !emVoo) {
        emVoo = true;
        try {
          await sincronizar();
        } catch (e) {
          if (!cancelado) setErroLista(mensagemErro(e));
        } finally {
          emVoo = false;
        }
      }
      if (cancelado || document.visibilityState === 'hidden') return;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        ciclo,
        abertaRef.current !== null ? INTERVALO_COM_CONVERSA_MS : INTERVALO_SEM_CONVERSA_MS,
      );
    }

    function aoMudarVisibilidade() {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(timer);
        return;
      }
      if (abertaRef.current !== null) marcarLida(abertaRef.current);
      void ciclo();
    }

    void ciclo();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [sincronizar]);

  // Fecha a conversa aberta (volta à lista).
  const fecharConversa = useCallback(() => {
    abertaRef.current = null;
    cursorRef.current = null;
    geracaoRef.current += 1;
    setAbertaId(null);
    setMensagens([]);
    setHaMais(false);
    setDigitando([]);
    setLeitura(null);
    setOnline(null);
    setErroConversa(null);
    setCarregandoMensagens(false);
    setCarregandoAnteriores(false);
    setDetalheAberto(false);
  }, []);

  // Abre uma conversa: carrega a lista, a leitura e a primeira página de mensagens.
  const abrir = useCallback(
    async (id: number) => {
      geracaoRef.current += 1;
      const geracao = geracaoRef.current;
      abertaRef.current = id;
      cursorRef.current = null;

      setAbertaId(id);
      setMensagens([]);
      setHaMais(false);
      setDigitando([]);
      setLeitura(null);
      setOnline(null);
      setErroConversa(null);
      setCarregandoMensagens(true);
      setDetalheAberto(false);
      setConversas((atual) => atual.map((c) => (c.id === id ? { ...c, naoLidas: 0 } : c)));

      try {
        const [, pagina] = await Promise.all([
          sincronizar(true),
          api.get<PaginaMensagensChat>(`/chat/conversas/${id}/mensagens?limite=${PAGINA_MENSAGENS}`),
        ]);
        if (geracao !== geracaoRef.current) return;
        setMensagens((atual) => mesclarRecebidas(atual, pagina.itens));
        setHaMais(pagina.haMais);
        marcarLida(id);
      } catch (e) {
        if (geracao === geracaoRef.current) setErroConversa(mensagemErro(e));
      } finally {
        if (geracao === geracaoRef.current) setCarregandoMensagens(false);
      }
    },
    [sincronizar],
  );

  // Mensagens mais antigas que a primeira carregada.
  const primeiroIdReal = useMemo(() => {
    for (const m of mensagens) if (m.id > 0) return m.id;
    return null;
  }, [mensagens]);

  const carregarAnteriores = useCallback(async () => {
    const id = abertaRef.current;
    if (id === null || primeiroIdReal === null || carregandoAnteriores) return;
    const geracao = geracaoRef.current;
    setCarregandoAnteriores(true);
    try {
      const pagina = await api.get<PaginaMensagensChat>(
        `/chat/conversas/${id}/mensagens?limite=${PAGINA_MENSAGENS}&antesDe=${primeiroIdReal}`,
      );
      if (geracao !== geracaoRef.current) return;
      setMensagens((atual) => mesclarMensagens(atual, pagina.itens));
      setHaMais(pagina.haMais);
    } catch (e) {
      if (geracao === geracaoRef.current) setErroConversa(mensagemErro(e));
    } finally {
      if (geracao === geracaoRef.current) setCarregandoAnteriores(false);
    }
  }, [primeiroIdReal, carregandoAnteriores]);

  // Envio: a mensagem aparece na hora (id negativo) e é trocada pela confirmada do servidor.
  const enviar = useCallback(
    async (envio: EnvioPendente, citacao: CitacaoChat | null) => {
      const id = abertaRef.current;
      if (id === null) return;
      const geracao = geracaoRef.current;
      contadorTempRef.current += 1;
      const tempId = -contadorTempRef.current;

      const temporaria: MensagemTela = {
        id: tempId,
        conversaId: id,
        autor: { id: eu.id, nome: eu.nome, foto: null },
        texto: envio.texto,
        imagem: envio.imagem,
        apagada: false,
        sistema: false,
        respostaA: citacao,
        criadaEm: new Date().toISOString(),
        minha: true,
        estado: 'ENVIADA',
        pendente: { ...envio, status: 'enviando' },
      };
      setMensagens((atual) => mesclarMensagens(atual, [temporaria]));

      try {
        const confirmada = await api.post<MensagemChat>(`/chat/conversas/${id}/mensagens`, {
          texto: envio.texto === '' ? undefined : envio.texto,
          imagem: envio.imagem ?? undefined,
          respostaAId: envio.respostaAId ?? undefined,
        });
        if (geracao !== geracaoRef.current) return;
        setMensagens((atual) =>
          mesclarMensagens(
            atual.filter((m) => m.id !== tempId),
            [{ ...confirmada, minha: true }],
          ),
        );
      } catch (e) {
        if (geracao !== geracaoRef.current) return;
        const erro = mensagemErro(e);
        setMensagens((atual) =>
          atual.map((m) =>
            m.id === tempId && m.pendente
              ? { ...m, pendente: { ...m.pendente, status: 'falhou', erro } }
              : m,
          ),
        );
      }
    },
    [eu.id, eu.nome],
  );

  const reenviar = useCallback(
    (m: MensagemTela) => {
      if (!m.pendente) return;
      const envio = m.pendente;
      setMensagens((atual) => atual.filter((x) => x.id !== m.id));
      void enviar({ ...envio, status: 'enviando', erro: undefined }, m.respostaA);
    },
    [enviar],
  );

  // Apaga a própria mensagem (ou descarta um envio que nem chegou ao servidor).
  const apagar = useCallback(async (m: MensagemTela) => {
    if (m.id < 0) {
      setMensagens((atual) => atual.filter((x) => x.id !== m.id));
      return;
    }
    await api.del(`/chat/mensagens/${m.id}`);
    setMensagens((atual) =>
      atual.map((x) => (x.id === m.id ? { ...x, texto: '', imagem: null, apagada: true } : x)),
    );
  }, []);

  // Descarta uma mensagem que falhou ao enviar (só local, sem chamar a API).
  const descartar = useCallback((m: MensagemTela) => {
    setMensagens((atual) => atual.filter((x) => x.id !== m.id));
  }, []);

  // Aviso de digitação (o servidor guarda por 5 s; a tela manda no máximo uma vez a cada 3 s).
  const digitar = useCallback(() => {
    const id = abertaRef.current;
    if (id === null) return;
    api.post(`/chat/conversas/${id}/digitando`).catch(() => undefined);
  }, []);

  const conversaAtual = conversas.find((c) => c.id === abertaId) ?? null;

  return (
    <div className={abertaId !== null ? 'chat-raiz chat-raiz-com-conversa' : 'chat-raiz'}>
      <div className="chat-coluna-lista">
        <ListaConversas
          conversas={conversas}
          abertaId={abertaId}
          carregando={carregandoLista}
          erro={erroLista}
          busca={busca}
          aoBuscar={setBusca}
          aoAbrir={(id) => void abrir(id)}
          aoNova={() => setNovaAberta(true)}
        />
      </div>

      <div className="chat-coluna-conversa">
        {abertaId !== null ? (
          <Conversa
            conversa={conversaAtual}
            eu={eu}
            mensagens={mensagens}
            haMais={haMais}
            carregandoMensagens={carregandoMensagens}
            carregandoAnteriores={carregandoAnteriores}
            erro={erroConversa}
            digitando={digitando}
            leitura={leitura}
            online={online}
            aoVoltar={fecharConversa}
            aoEnviar={(envio, citacao) => void enviar(envio, citacao)}
            aoReenviar={reenviar}
            aoApagar={apagar}
            aoDescartar={descartar}
            aoCarregarAnteriores={() => void carregarAnteriores()}
            aoDigitar={digitar}
            aoAbrirDetalhe={() => setDetalheAberto(true)}
          />
        ) : (
          <div className="chat-sem-conversa">
            <span className="chat-sem-conversa-icone" aria-hidden="true">
              <Icone nome="chat" tamanho={56} />
            </span>
            <p className="chat-sem-conversa-titulo">Nenhuma conversa selecionada</p>
            <p className="chat-vazio-texto">Escolha uma conversa à esquerda ou comece uma nova.</p>
          </div>
        )}
      </div>

      <NovaConversa
        aberto={novaAberta}
        aoFechar={() => setNovaAberta(false)}
        aoCriada={(id) => {
          setNovaAberta(false);
          void abrir(id);
        }}
      />

      <DetalheGrupo
        aberto={detalheAberto && conversaAtual?.tipo === 'GRUPO'}
        conversaId={abertaId}
        souAdmin={conversaAtual?.souAdmin ?? false}
        eu={eu}
        aoFechar={() => setDetalheAberto(false)}
        aoSair={() => {
          fecharConversa();
          void sincronizar(true);
        }}
        aoAlterar={() => void sincronizar(true)}
      />
    </div>
  );
}
