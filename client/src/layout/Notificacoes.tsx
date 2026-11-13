import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatarDataHora } from '../ui';
import { Icone } from '../ui/icones';
import type { NomeIcone } from '../ui/icones';

// Central de notificações (o sino do topo): contador de não lidas e painel com os avisos.
// `raiz` é o caminho do portal (ex.: /admin); o link de cada aviso fica em `${raiz}${link}`.

type TipoNotificacao =
  | 'COMUNICADO'
  | 'SUPORTE'
  | 'FORUM'
  | 'NOTA'
  | 'FINANCEIRO'
  | 'MEDALHA'
  | 'BIBLIOTECA'
  | 'AULA'
  | 'SISTEMA';

interface NotificacaoDTO {
  id: number;
  tipo: TipoNotificacao;
  titulo: string;
  texto: string;
  link: string | null;
  criadaEm: string;
  lida: boolean;
}

interface ListaNotificacoesDTO {
  itens: NotificacaoDTO[];
  haMais: boolean;
  naoLidas: number;
}

// Consulta do contador a cada 30 s (pausa com a aba oculta).
const INTERVALO_CONTADOR_MS = 30000;
const TAMANHO_PAGINA = 20;

const ICONE_POR_TIPO: Record<TipoNotificacao, NomeIcone> = {
  COMUNICADO: 'comunicados',
  SUPORTE: 'suporte',
  FORUM: 'forum',
  NOTA: 'boletim',
  FINANCEIRO: 'financeiro',
  MEDALHA: 'medalha',
  BIBLIOTECA: 'biblioteca',
  AULA: 'diario',
  SISTEMA: 'engrenagem',
};

// Tempo relativo em português ("há 5 min"); depois de uma semana, a data.
function tempoRelativo(iso: string): string {
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) return '';
  const minutos = Math.floor((Date.now() - instante) / 60000);
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
  return formatarDataHora(iso);
}

export function Notificacoes({ raiz }: { raiz: string }) {
  const navigate = useNavigate();
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<NotificacaoDTO[]>([]);
  const [haMais, setHaMais] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const area = useRef<HTMLDivElement>(null);

  // Busca só o contador. Falha em silêncio: mantém o último valor conhecido.
  const atualizarContador = useCallback(async (): Promise<void> => {
    try {
      const resposta = await api.get<{ total: number }>('/notificacoes/nao-lidas');
      setNaoLidas(resposta.total);
    } catch {
      // Sem ação: o próximo ciclo tenta de novo.
    }
  }, []);

  // Contador: consulta a cada 30 s, pausa com a aba oculta e atualiza ao voltar o foco.
  useEffect(() => {
    let id: number | undefined;

    function iniciar(): void {
      if (id !== undefined) return;
      id = window.setInterval(() => void atualizarContador(), INTERVALO_CONTADOR_MS);
    }

    function parar(): void {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    }

    function aoMudarVisibilidade(): void {
      if (document.visibilityState === 'hidden') {
        parar();
      } else {
        void atualizarContador();
        iniciar();
      }
    }

    function aoFocar(): void {
      if (document.visibilityState !== 'hidden') void atualizarContador();
    }

    if (document.visibilityState !== 'hidden') {
      void atualizarContador();
      iniciar();
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    window.addEventListener('focus', aoFocar);

    return () => {
      parar();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      window.removeEventListener('focus', aoFocar);
    };
  }, [atualizarContador]);

  // Fecha com Esc e com clique fora do sino e do painel.
  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (area.current && !area.current.contains(e.target as Node)) setAberto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  // Ao abrir, carrega os avisos mais recentes.
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setCarregando(true);
    setErro(false);
    api
      .get<ListaNotificacoesDTO>(`/notificacoes?limite=${TAMANHO_PAGINA}`)
      .then((resposta) => {
        if (cancelado) return;
        setItens(resposta.itens);
        setHaMais(resposta.haMais);
        setNaoLidas(resposta.naoLidas);
      })
      .catch(() => {
        if (!cancelado) setErro(true);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [aberto]);

  // Carrega a página seguinte, a partir do aviso mais antigo da lista.
  async function carregarMais(): Promise<void> {
    const ultimo = itens[itens.length - 1];
    if (!ultimo || carregando) return;
    setCarregando(true);
    setErro(false);
    try {
      const resposta = await api.get<ListaNotificacoesDTO>(
        `/notificacoes?limite=${TAMANHO_PAGINA}&antesDe=${ultimo.id}`,
      );
      setItens((atuais) => [...atuais, ...resposta.itens]);
      setHaMais(resposta.haMais);
      setNaoLidas(resposta.naoLidas);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  // Marca como lido (se ainda não estiver) e, se tiver link, fecha o painel e abre a página.
  function abrirAviso(item: NotificacaoDTO): void {
    if (!item.lida) {
      setItens((atuais) => atuais.map((n) => (n.id === item.id ? { ...n, lida: true } : n)));
      setNaoLidas((total) => Math.max(0, total - 1));
      api.post(`/notificacoes/${item.id}/lida`).catch(() => void atualizarContador());
    }
    // Só caminho interno do portal: link externo ou malformado não navega.
    const linkInterno =
      item.link && item.link.startsWith('/') && !item.link.startsWith('//') ? item.link : null;
    if (linkInterno) {
      setAberto(false);
      navigate(`${raiz}${linkInterno}`);
    }
  }

  function marcarTodas(): void {
    setItens((atuais) => atuais.map((n) => ({ ...n, lida: true })));
    setNaoLidas(0);
    api.post('/notificacoes/lidas').catch(() => {
      setErro(true);
      void atualizarContador();
    });
  }

  return (
    <div className="casca-sino-area" ref={area}>
      <button
        type="button"
        className="casca-botao-redondo"
        aria-label={naoLidas > 0 ? `Avisos, ${naoLidas} não lidos` : 'Avisos'}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <Icone nome="sino" tamanho={22} />
        {naoLidas > 0 && (
          <span className="casca-contador" aria-hidden="true">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="casca-painel-avisos" role="dialog" aria-label="Avisos">
          <div className="casca-painel-cabecalho">
            <strong>Avisos</strong>
            <button
              type="button"
              className="casca-link casca-link-botao"
              onClick={marcarTodas}
              disabled={naoLidas === 0}
            >
              Marcar todas como lidas
            </button>
          </div>

          {erro && <p className="casca-painel-vazio">Não foi possível carregar os avisos.</p>}
          {!carregando && !erro && itens.length === 0 && (
            <p className="casca-painel-vazio">Nenhum aviso por aqui.</p>
          )}

          <ul className="casca-avisos-lista">
            {itens.map((n) => (
              <li key={n.id}>
                <button type="button" className="casca-aviso" onClick={() => abrirAviso(n)}>
                  <span className="casca-aviso-icone" aria-hidden="true">
                    <Icone nome={ICONE_POR_TIPO[n.tipo] ?? 'engrenagem'} tamanho={18} />
                  </span>
                  <span className="casca-aviso-texto">
                    <span className={n.lida ? 'casca-aviso-titulo' : 'casca-aviso-titulo casca-aviso-titulo-novo'}>
                      {n.titulo}
                    </span>
                    {n.texto && <span className="casca-aviso-corpo">{n.texto}</span>}
                    <span className="casca-aviso-meta">{tempoRelativo(n.criadaEm)}</span>
                  </span>
                  <span
                    className={n.lida ? 'casca-aviso-ponto casca-aviso-ponto-lido' : 'casca-aviso-ponto'}
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>

          {carregando && <p className="casca-painel-vazio">Carregando...</p>}

          {!carregando && haMais && (
            <div className="casca-painel-rodape">
              <button type="button" className="casca-link casca-link-botao" onClick={() => void carregarMais()}>
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
