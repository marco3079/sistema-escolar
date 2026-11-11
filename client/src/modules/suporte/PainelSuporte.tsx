import { useEffect, useRef, useState } from 'react';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Carregando } from '../../ui';
import { Icone } from '../../ui/icones';
import { Conversa } from './Conversa';
import { NovoChamado } from './NovoChamado';
import {
  SeloStatus,
  tempoRelativo,
  useAtualizacao,
} from './comum';
import type { ChamadoDTO } from './comum';
import './suporte.css';

const INTERVALO_LISTA = 15000;

type Filtro = 'abertos' | 'encerrados' | 'todos';

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'abertos', rotulo: 'Abertos' },
  { valor: 'encerrados', rotulo: 'Encerrados' },
  { valor: 'todos', rotulo: 'Todos' },
];

function passaFiltro(c: ChamadoDTO, filtro: Filtro): boolean {
  if (filtro === 'abertos') return c.status !== 'FECHADO';
  if (filtro === 'encerrados') return c.status === 'FECHADO';
  return true;
}

// Popup "Suporte": os chamados da pessoa, a etapa de cada um e a conversa com a equipe.
export function PainelSuporte({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [filtro, setFiltro] = useState<Filtro>('abertos');
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [novo, setNovo] = useState(false);

  const { dados, carregando, erro, recarregar } = useDados<ChamadoDTO[]>(
    aberto ? '/chamados/meus' : null,
  );
  useAtualizacao(recarregar, INTERVALO_LISTA, aberto);

  const caixa = useRef<HTMLDivElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const aoFecharAtual = useRef(aoFechar);

  useEffect(() => {
    aoFecharAtual.current = aoFechar;
  });

  // Ao fechar, a tela volta ao estado inicial.
  useEffect(() => {
    if (!aberto) {
      setSelecionado(null);
      setNovo(false);
    }
  }, [aberto]);

  // Foco preso dentro do popup; Escape fecha, exceto quando um diálogo aninhado está aberto.
  useEffect(() => {
    if (!aberto) return;
    // Elemento que estava focado antes de abrir: o foco volta a ele ao fechar.
    const anterior = document.activeElement as HTMLElement | null;
    botaoFechar.current?.focus();
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (document.querySelector('.modal-fundo')) return;
        aoFecharAtual.current();
        return;
      }
      if (e.key !== 'Tab' || !caixa.current) return;
      const focaveis = Array.from(
        caixa.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement as HTMLElement | null;
      const dentro = ativo !== null && caixa.current.contains(ativo);
      if (e.shiftKey && (!dentro || ativo === primeiro)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (!dentro || ativo === ultimo)) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      anterior?.focus?.();
    };
  }, [aberto]);

  if (!aberto) return null;

  const visiveis = (dados ?? []).filter((c) => passaFiltro(c, filtro));

  return (
    <div
      className="suporte-fundo"
      onClick={(e) => {
        // Clique só no fundo fecha (cliques em diálogos aninhados também chegam aqui).
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={caixa}
        className="suporte-painel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suporte-titulo"
      >
        <header className="suporte-painel-cabecalho">
          <h2 id="suporte-titulo">Suporte</h2>
          <button
            ref={botaoFechar}
            type="button"
            className="suporte-fechar"
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <Icone nome="fechar" tamanho={20} />
          </button>
        </header>

        <div className={selecionado !== null ? 'suporte-corpo suporte-corpo-conversa' : 'suporte-corpo'}>
          <section className="suporte-coluna-lista" aria-label="Meus chamados">
            <div className="suporte-lista-topo">
              <h3>Meus chamados</h3>
              <Botao aoClicar={() => setNovo(true)}>Novo chamado</Botao>
            </div>

            <div className="segmentado suporte-filtros" role="group" aria-label="Filtrar chamados">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  className="segmentado-item"
                  aria-pressed={filtro === f.valor}
                  onClick={() => setFiltro(f.valor)}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>

            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            {carregando && dados === null && <Carregando />}
            {dados !== null && visiveis.length === 0 && (
              <p className="suporte-vazio">Nenhum chamado aqui.</p>
            )}

            <ul className="suporte-lista">
              {visiveis.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={c.id === selecionado ? 'suporte-item suporte-item-ativo' : 'suporte-item'}
                    aria-current={c.id === selecionado ? 'true' : undefined}
                    onClick={() => setSelecionado(c.id)}
                  >
                    <span className="suporte-item-topo">
                      <span className="suporte-item-assunto">{c.assunto}</span>
                      {c.naoLido && <span className="suporte-ponto" role="img" aria-label="Nova resposta" />}
                    </span>
                    <span className="suporte-item-previa">{c.previa}</span>
                    <span className="suporte-item-rodape">
                      <SeloStatus status={c.status} souEquipe={false} />
                      <span className="suporte-item-tempo">{tempoRelativo(c.ultimaMensagemEm)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="suporte-coluna-conversa" aria-label="Conversa">
            {selecionado !== null ? (
              <>
                <button type="button" className="suporte-voltar" onClick={() => setSelecionado(null)}>
                  Voltar à lista
                </button>
                <Conversa key={selecionado} chamadoId={selecionado} aoMudar={recarregar} />
              </>
            ) : (
              <div className="suporte-vazio-grande">
                <Icone nome="suporte" tamanho={40} />
                <p>Escolha um chamado ou abra um novo.</p>
              </div>
            )}
          </section>
        </div>

        <NovoChamado
          aberto={novo}
          aoFechar={() => setNovo(false)}
          aoCriado={(criado) => {
            setNovo(false);
            setSelecionado(criado.id);
            recarregar();
          }}
        />
      </div>
    </div>
  );
}
