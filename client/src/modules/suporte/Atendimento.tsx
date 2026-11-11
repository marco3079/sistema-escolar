import { useEffect, useMemo, useState } from 'react';
import { useDados } from '../../lib/useDados';
import { Aviso, Avatar, Caixa, Campo, Carregando, Pagina, Selecao } from '../../ui';
import { Icone } from '../../ui/icones';
import type { NomeIcone } from '../../ui/icones';
import { Conversa } from './Conversa';
import {
  CATEGORIAS,
  PRIORIDADES,
  SeloCategoria,
  SeloPrioridade,
  SeloStatus,
  tempoRelativo,
  useAtualizacao,
} from './comum';
import type { Categoria, ChamadoDTO, Prioridade, StatusChamado } from './comum';
import './suporte.css';

const INTERVALO_LISTA = 15000;
const ATRASO_BUSCA = 300;

const STATUS_FILTRO: { valor: StatusChamado; rotulo: string }[] = [
  { valor: 'ABERTO', rotulo: 'Aberto' },
  { valor: 'EM_ATENDIMENTO', rotulo: 'Em atendimento' },
  { valor: 'AGUARDANDO_USUARIO', rotulo: 'Aguardando o usuário' },
  { valor: 'RESOLVIDO', rotulo: 'Resolvido' },
  { valor: 'FECHADO', rotulo: 'Fechado' },
];

// Cartão de resumo: mesmo markup da fileira de /admin/usuarios (classes resumo e resumo-item).
function ResumoItem({
  icone,
  cor,
  valor,
  rotulo,
}: {
  icone: NomeIcone;
  cor: 'azul' | 'roxo' | 'verde' | 'laranja';
  valor: number;
  rotulo: string;
}) {
  return (
    <div className="resumo-item">
      <span className={`resumo-icone resumo-icone-${cor}`} aria-hidden="true">
        <Icone nome={icone} tamanho={24} />
      </span>
      <div>
        <span className="resumo-valor">{valor}</span>
        <span className="resumo-rotulo">{rotulo}</span>
      </div>
    </div>
  );
}

// Não lidos primeiro, depois prioridade alta. Dentro de cada grupo vale a ordem do servidor (mais recentes primeiro).
function pesoOrdenacao(c: ChamadoDTO): number {
  return (c.naoLido ? 2 : 0) + (c.prioridade === 'ALTA' ? 1 : 0);
}

// Área de quem atende: chamados da sua categoria, com resumo, filtros e a conversa ao lado.
export function Atendimento() {
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [status, setStatus] = useState<StatusChamado | ''>('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [prioridade, setPrioridade] = useState<Prioridade | ''>('');
  const [soMeus, setSoMeus] = useState(false);
  const [selecionado, setSelecionado] = useState<number | null>(null);

  // A busca espera a pessoa parar de digitar.
  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaAplicada(busca.trim()), ATRASO_BUSCA);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const consulta = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (categoria) params.set('categoria', categoria);
    if (prioridade) params.set('prioridade', prioridade);
    if (buscaAplicada) params.set('busca', buscaAplicada);
    if (soMeus) params.set('meus', 'true');
    const texto = params.toString();
    return texto ? `/chamados/atendimento?${texto}` : '/chamados/atendimento';
  }, [status, categoria, prioridade, buscaAplicada, soMeus]);

  // Resumo: sem filtros, todos os chamados que a pessoa atende.
  const resumo = useDados<ChamadoDTO[]>('/chamados/atendimento');
  const lista = useDados<ChamadoDTO[]>(consulta);

  function atualizarTudo() {
    resumo.recarregar();
    lista.recarregar();
  }
  useAtualizacao(atualizarTudo, INTERVALO_LISTA, true);

  const ordenados = useMemo(
    () => [...(lista.dados ?? [])].sort((a, b) => pesoOrdenacao(b) - pesoOrdenacao(a)),
    [lista.dados],
  );

  const todos = resumo.dados ?? [];
  const contagem = {
    aguardando: todos.filter((c) => c.status === 'ABERTO').length,
    emAtendimento: todos.filter(
      (c) => c.status === 'EM_ATENDIMENTO' || c.status === 'AGUARDANDO_USUARIO',
    ).length,
    resolvidos: todos.filter((c) => c.status === 'RESOLVIDO').length,
    total: todos.length,
  };

  return (
    <Pagina titulo="Atendimento">
      <div className="resumo">
        <ResumoItem icone="relogio" cor="laranja" valor={contagem.aguardando} rotulo="Aguardando resposta" />
        <ResumoItem icone="suporte" cor="azul" valor={contagem.emAtendimento} rotulo="Em atendimento" />
        <ResumoItem icone="medalha" cor="verde" valor={contagem.resolvidos} rotulo="Resolvidos" />
        <ResumoItem icone="lista" cor="roxo" valor={contagem.total} rotulo="Total" />
      </div>

      <div className="barra-ferramentas">
        <div className="filtros">
          <Campo rotulo="Buscar pelo assunto" valor={busca} aoMudar={setBusca} />
          <Selecao
            rotulo="Status"
            valor={status}
            vazio="Todos os status"
            opcoes={STATUS_FILTRO}
            aoMudar={(v) => setStatus(v as StatusChamado | '')}
          />
          <Selecao
            rotulo="Categoria"
            valor={categoria}
            vazio="Todas as categorias"
            opcoes={CATEGORIAS}
            aoMudar={(v) => setCategoria(v as Categoria | '')}
          />
          <Selecao
            rotulo="Prioridade"
            valor={prioridade}
            vazio="Todas as prioridades"
            opcoes={PRIORIDADES}
            aoMudar={(v) => setPrioridade(v as Prioridade | '')}
          />
        </div>
        <div className="suporte-filtro-caixa">
          <Caixa rotulo="Só os meus" marcado={soMeus} aoMudar={setSoMeus} />
        </div>
      </div>

      {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
      {lista.carregando && lista.dados === null && <Carregando />}

      <div className={selecionado !== null ? 'suporte-atendimento suporte-com-conversa' : 'suporte-atendimento'}>
        <section className="suporte-atendimento-lista" aria-label="Chamados para atender">
          {lista.dados !== null && ordenados.length === 0 && (
            <p className="suporte-vazio">Nenhum chamado encontrado.</p>
          )}
          <ul className="suporte-lista">
            {ordenados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={c.id === selecionado ? 'suporte-item suporte-item-ativo' : 'suporte-item'}
                  aria-current={c.id === selecionado ? 'true' : undefined}
                  onClick={() => setSelecionado(c.id)}
                >
                  <span className="suporte-item-topo">
                    <Avatar nome={c.autor.nome} foto={c.autor.foto} tamanho={28} />
                    <span className="suporte-item-autor">{c.autor.nome}</span>
                    {c.naoLido && <span className="suporte-ponto" role="img" aria-label="Não lido" />}
                  </span>
                  <span className="suporte-item-assunto">{c.assunto}</span>
                  <span className="suporte-item-previa">{c.previa}</span>
                  <span className="suporte-item-rodape">
                    <SeloCategoria categoria={c.categoria} />
                    <SeloPrioridade prioridade={c.prioridade} />
                    <SeloStatus status={c.status} souEquipe={c.souEquipe} />
                    <span className="suporte-item-tempo">{tempoRelativo(c.ultimaMensagemEm)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="suporte-atendimento-conversa" aria-label="Conversa">
          {selecionado !== null ? (
            <>
              <button type="button" className="suporte-voltar" onClick={() => setSelecionado(null)}>
                Voltar à lista
              </button>
              <Conversa key={selecionado} chamadoId={selecionado} aoMudar={atualizarTudo} />
            </>
          ) : (
            <div className="suporte-vazio-grande">
              <p>Escolha um chamado para responder.</p>
            </div>
          )}
        </section>
      </div>
    </Pagina>
  );
}
