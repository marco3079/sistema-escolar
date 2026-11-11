import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useDados } from '../../lib/useDados';
import { Aviso, Avatar, Botao, Campo, Carregando, Pagina, Selecao } from '../../ui';
import { BarraLateral, CriarComunidade } from './BarraLateral';
import { CartaoPublicacao } from './CartaoPublicacao';
import { NovaPublicacao } from './NovaPublicacao';
import {
  ORDENS,
  TAMANHO_PAGINA,
  classeCor,
  contarPublicacoes,
  mensagemErro,
  montarQuery,
  useBase,
} from './comum';
import type { ComunidadeDTO, ListaPublicacoes, Ordem, PublicacaoDTO } from './comum';

// Feed geral (/forum) e de uma comunidade (/forum/c/:slug). Duas colunas a partir de 1000 px.
export function Feed() {
  const { slug } = useParams();
  const base = useBase();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const comunidadesDados = useDados<ComunidadeDTO[]>('/forum/comunidades');
  const comunidades = comunidadesDados.dados;
  const comunidadeAtual = slug ? comunidades?.find((c) => c.slug === slug) ?? null : null;

  const [ordem, setOrdem] = useState<Ordem>('alta');
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<PublicacaoDTO[]>([]);
  const [haMais, setHaMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [novaAberta, setNovaAberta] = useState(false);

  // Busca com espera de 300 ms depois da última tecla.
  useEffect(() => {
    const espera = setTimeout(() => setBusca(buscaDigitada.trim()), 300);
    return () => clearTimeout(espera);
  }, [buscaDigitada]);

  // Primeira página sempre que mudam comunidade, ordem, busca ou ao recarregar.
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    api
      .get<ListaPublicacoes>(
        `/forum/publicacoes?${montarQuery({ comunidade: slug, ordem, busca, limite: TAMANHO_PAGINA })}`
      )
      .then((r) => {
        if (cancelado) return;
        setItens(r.itens);
        setHaMais(r.haMais);
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(mensagemErro(e));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [slug, ordem, busca, versao]);

  async function carregarMais() {
    const ultimo = itens[itens.length - 1];
    if (!ultimo) return;
    setCarregandoMais(true);
    setErro(null);
    try {
      const r = await api.get<ListaPublicacoes>(
        `/forum/publicacoes?${montarQuery({
          comunidade: slug,
          ordem,
          busca,
          antesDe: ultimo.id,
          limite: TAMANHO_PAGINA,
        })}`
      );
      setItens((atuais) => [...atuais, ...r.itens.filter((i) => !atuais.some((a) => a.id === i.id))]);
      setHaMais(r.haMais);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregandoMais(false);
    }
  }

  // Troca a publicação na lista (edição, voto de moderação) ou a tira (exclusão).
  function aoMudarPublicacao(id: number, nova: PublicacaoDTO | null) {
    setItens((atuais) =>
      nova ? atuais.map((p) => (p.id === id ? nova : p)) : atuais.filter((p) => p.id !== id)
    );
  }

  if (slug && comunidadesDados.carregando === false && comunidades && !comunidadeAtual) {
    return (
      <Pagina titulo="Fórum">
        <Aviso tipo="erro">Comunidade não encontrada.</Aviso>
      </Pagina>
    );
  }

  return (
    <Pagina titulo="Fórum">
      <div className="forum">
        <div className="forum-principal">
          {comunidadeAtual ? (
            <header className={`forum-faixa forum-faixa-${classeCor(comunidadeAtual.cor)}`}>
              <h2>{comunidadeAtual.nome}</h2>
              {comunidadeAtual.descricao && <p>{comunidadeAtual.descricao}</p>}
              <span className="forum-texto-suave">{contarPublicacoes(comunidadeAtual.publicacoes)}</span>
            </header>
          ) : (
            <p className="forum-frase">Pergunte, responda e vote nas publicações da escola.</p>
          )}

          <div className="forum-so-celular">
            <Selecao
              rotulo="Comunidade"
              valor={slug ?? ''}
              aoMudar={(v) => navigate(v ? `${base}/forum/c/${v}` : `${base}/forum`)}
              opcoes={(comunidades ?? []).map((c) => ({ valor: c.slug, rotulo: c.nome }))}
              vazio="Todas as comunidades"
            />
            <CriarComunidade aoCriada={comunidadesDados.recarregar} />
          </div>

          <div className="forum-caixa-criar cartao">
            <Avatar nome={usuario?.nome ?? ''} foto={usuario?.foto ?? null} tamanho={36} />
            <button type="button" className="forum-campo-falso" onClick={() => setNovaAberta(true)}>
              Escreva uma publicação...
            </button>
          </div>

          <div className="barra-ferramentas">
            <div className="segmentado" role="group" aria-label="Ordenar publicações">
              {ORDENS.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className="segmentado-item"
                  aria-pressed={ordem === o.valor}
                  onClick={() => setOrdem(o.valor)}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
            <div className="filtros">
              <Campo rotulo="Buscar publicações" valor={buscaDigitada} aoMudar={setBuscaDigitada} />
            </div>
          </div>

          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          {carregando && itens.length === 0 && <Carregando />}
          {!carregando && !erro && itens.length === 0 && (
            <p className="forum-vazio">
              {busca
                ? 'Nenhuma publicação encontrada para esta busca.'
                : 'Nenhuma publicação ainda. Seja a primeira pessoa a publicar.'}
            </p>
          )}

          {itens.length > 0 && (
            <ol className="forum-lista">
              {itens.map((p) => (
                <li key={p.id}>
                  <CartaoPublicacao publicacao={p} aoMudar={(nova) => aoMudarPublicacao(p.id, nova)} />
                </li>
              ))}
            </ol>
          )}

          {haMais && !carregando && (
            <div className="forum-mais">
              <Botao variante="secundario" desabilitado={carregandoMais} aoClicar={carregarMais}>
                {carregandoMais ? 'Carregando...' : 'Carregar mais'}
              </Botao>
            </div>
          )}
        </div>

        <aside className="forum-barra-lateral">
          <BarraLateral
            base={base}
            comunidades={comunidades}
            carregando={comunidadesDados.carregando}
            erro={comunidadesDados.erro}
            slugAtual={slug ?? null}
            aoCriada={comunidadesDados.recarregar}
          />
        </aside>
      </div>

      <NovaPublicacao
        aberto={novaAberta}
        aoFechar={() => setNovaAberta(false)}
        comunidades={comunidades ?? []}
        comunidadeInicial={slug ?? ''}
      />
    </Pagina>
  );
}
