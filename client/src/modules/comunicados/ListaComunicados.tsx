import { useEffect, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { api } from '../../lib/api';
import { Aviso, Carregando, Modal, Selecao, Selo } from '../../ui';
import { Icone } from '../../ui/icones';
import { LeituraComunicado } from './LeituraComunicado';
import { corDoAvatar, corDoPublico, iniciais, previa, tempoRelativo } from './formatosComunicado';
import { PUBLICOS, rotuloPublico } from './tipos';
import type { ComunicadoDTO, PublicoComunicado } from './tipos';
import './comunicados.css';

const TELA_LARGA = '(min-width: 1000px)';

// true a partir de 1000 px: lista e leitura lado a lado.
function usarTelaLarga(): boolean {
  const [larga, setLarga] = useState(() => window.matchMedia(TELA_LARGA).matches);
  useEffect(() => {
    const consulta = window.matchMedia(TELA_LARGA);
    const ouvir = () => setLarga(consulta.matches);
    consulta.addEventListener('change', ouvir);
    return () => consulta.removeEventListener('change', ouvir);
  }, []);
  return larga;
}

// Caixa de avisos: busca e filtros, lista compacta e leitura ao lado (ou em Modal).
// Abrir um comunicado não lido marca como lido no servidor (POST /comunicados/:id/ler).
export function ListaComunicados({
  comunicados,
  carregando = false,
  acaoNovo,
  podeExcluir,
  aoExcluir,
}: {
  comunicados: ComunicadoDTO[];
  carregando?: boolean;
  acaoNovo?: ReactNode;
  podeExcluir?: (comunicado: ComunicadoDTO) => boolean;
  aoExcluir?: (comunicado: ComunicadoDTO) => void;
}) {
  const larga = usarTelaLarga();
  const [busca, setBusca] = useState('');
  const [soNaoLidos, setSoNaoLidos] = useState(false);
  const [publicoFiltro, setPublicoFiltro] = useState<'' | PublicoComunicado>('');
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [lidosAgora, setLidosAgora] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState<string | null>(null);

  const naoLido = (c: ComunicadoDTO) => !c.lido && !lidosAgora.has(c.id);
  const naoLidos = comunicados.filter(naoLido).length;

  const termo = busca.trim().toLowerCase();
  const filtrados = comunicados.filter(
    (c) =>
      (!soNaoLidos || naoLido(c)) &&
      (!publicoFiltro || c.publico === publicoFiltro) &&
      (!termo ||
        c.titulo.toLowerCase().includes(termo) ||
        c.corpo.toLowerCase().includes(termo)),
  );

  // Cor do avatar pela posição na lista filtrada.
  const coresPorId = new Map(filtrados.map((c, i) => [c.id, corDoAvatar(i)] as const));
  const selecionado = comunicados.find((c) => c.id === selecionadoId) ?? null;

  function acaoExcluir(c: ComunicadoDTO): (() => void) | undefined {
    const excluir = aoExcluir;
    if (!excluir || !podeExcluir?.(c)) return undefined;
    return () => excluir(c);
  }

  async function selecionar(c: ComunicadoDTO) {
    setSelecionadoId(c.id);
    if (!naoLido(c)) return;
    try {
      await api.post(`/comunicados/${c.id}/ler`);
      setLidosAgora((atuais) => new Set(atuais).add(c.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    }
  }

  function aoTecla(e: KeyboardEvent<HTMLLIElement>, c: ComunicadoDTO) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selecionar(c);
    }
  }

  function leitura(c: ComunicadoDTO) {
    return (
      <LeituraComunicado
        comunicado={c}
        corAvatar={coresPorId.get(c.id) ?? corDoAvatar(0)}
        aoExcluir={acaoExcluir(c)}
      />
    );
  }

  return (
    <div className="comunicados-caixa">
      <div className="barra-ferramentas">
        <div className="comunicados-filtros-grupo">
          <label className="comunicados-busca">
            <Icone nome="busca" tamanho={18} className="comunicados-busca-icone" />
            <input
              type="search"
              className="campo-controle"
              placeholder="Buscar por título ou texto"
              aria-label="Buscar comunicados"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>

          <div className="comunicados-pilulas" role="group" aria-label="Filtrar por leitura">
            <button
              type="button"
              className="comunicados-pilula"
              aria-pressed={!soNaoLidos}
              onClick={() => setSoNaoLidos(false)}
            >
              Todos
            </button>
            <button
              type="button"
              className="comunicados-pilula"
              aria-pressed={soNaoLidos}
              onClick={() => setSoNaoLidos(true)}
            >
              Não lidos <span className="comunicados-contador">{naoLidos}</span>
            </button>
          </div>

          <div className="comunicados-selecao-publico">
            <Selecao
              rotulo="Público"
              valor={publicoFiltro}
              aoMudar={(v) => setPublicoFiltro(v as '' | PublicoComunicado)}
              opcoes={PUBLICOS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))}
              vazio="Todos os públicos"
            />
          </div>
        </div>
        {acaoNovo}
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <Carregando />
      ) : comunicados.length === 0 ? (
        <p className="comunicados-vazio">Nenhum comunicado por aqui.</p>
      ) : (
        <div className="comunicados-layout">
          <div className="comunicados-lista-coluna">
            {filtrados.length === 0 ? (
              <p className="comunicados-vazio">Nenhum comunicado com esses filtros.</p>
            ) : (
              <ul className="comunicado-lista" role="list">
                {filtrados.map((c, i) => {
                  const novo = naoLido(c);
                  const selecionada = selecionadoId === c.id;
                  const cor = corDoAvatar(i);
                  return (
                    <li
                      key={c.id}
                      className={
                        selecionada ? 'comunicado-linha comunicado-linha-selecionada' : 'comunicado-linha'
                      }
                      role="button"
                      tabIndex={0}
                      aria-current={selecionada ? 'true' : undefined}
                      onClick={() => selecionar(c)}
                      onKeyDown={(e) => aoTecla(e, c)}
                    >
                      <span className={`comunicado-avatar comunicado-avatar-${cor}`} aria-hidden="true">
                        {iniciais(c.autor.nome)}
                      </span>
                      <span className="comunicado-texto">
                        <span className={novo ? 'comunicado-titulo comunicado-titulo-novo' : 'comunicado-titulo'}>
                          {c.titulo}
                        </span>
                        <span className="comunicado-previa">{previa(c.corpo)}</span>
                        <span className="comunicado-meta">
                          <span className="comunicado-autor">{c.autor.nome}</span>
                          <Selo cor={corDoPublico(c.publico)}>{rotuloPublico(c)}</Selo>
                        </span>
                      </span>
                      <span className="comunicado-lado">
                        <span>{tempoRelativo(c.publicadoEm)}</span>
                        {novo && <span className="comunicado-ponto" role="img" aria-label="Não lido" />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {larga && (
            <aside className="comunicados-leitura-coluna" aria-label="Leitura do comunicado">
              {selecionado ? (
                leitura(selecionado)
              ) : (
                <div className="comunicados-vazio-leitura">
                  <Icone nome="comunicados" tamanho={40} />
                  <p>Selecione um comunicado para ler</p>
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {!larga && (
        <Modal
          aberto={selecionado !== null}
          titulo="Comunicado"
          aoFechar={() => setSelecionadoId(null)}
        >
          {selecionado && leitura(selecionado)}
        </Modal>
      )}
    </div>
  );
}
