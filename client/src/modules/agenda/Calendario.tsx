import { useMemo, useState } from 'react';
import { Botao, Cartao, Modal, Selo } from '../../ui';
import { Icone } from '../../ui/icones';
import type { EventoCalendario, TipoEvento } from './tipos';
import './agenda.css';

const SELOS: Record<TipoEvento, { rotulo: string; cor: 'azul' | 'vermelho' | 'amarelo' | 'verde' | 'cinza' }> = {
  LETIVO: { rotulo: 'Letivo', cor: 'azul' },
  FERIADO: { rotulo: 'Feriado', cor: 'vermelho' },
  PROVA: { rotulo: 'Prova', cor: 'amarelo' },
  EVENTO: { rotulo: 'Evento', cor: 'verde' },
  RECESSO: { rotulo: 'Recesso', cor: 'cinza' },
};

const ORDEM_TIPOS: TipoEvento[] = ['LETIVO', 'FERIADO', 'PROVA', 'EVENTO', 'RECESSO'];
const DIAS_CABECALHO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
// Até 3 faixas por dia; havendo mais, mostra 2 e "+N".
const LIMITE_FAIXAS = 3;
const PROXIMOS_TOTAL = 5;

type Visao = 'mes' | 'lista';

interface EventoNormalizado {
  evento: EventoCalendario;
  inicio: string; // "AAAA-MM-DD" (dia do calendário)
  fim: string; // "AAAA-MM-DD" (dia do calendário)
}

// ---------- Datas ----------
// Chaves "AAAA-MM-DD" comparam certo como texto.

function dois(n: number): string {
  return String(n).padStart(2, '0');
}

function chaveDeData(data: Date): string {
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

// Evento gravado sem hora vem como T00:00:00: lê o dia direto da string, sem deslocar de dia.
// Caso contrário, usa a data local.
function chaveDoIso(iso: string): string {
  const semHora = /^(\d{4}-\d{2}-\d{2})T00:00:00/.exec(iso);
  if (semHora) return semHora[1];
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '' : chaveDeData(data);
}

function dataDeChave(chave: string): Date {
  const [ano, mes, dia] = chave.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

function diaDaChave(chave: string): number {
  return Number(chave.slice(8, 10));
}

function rotuloMes(data: Date): string {
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function mesCurtoDaChave(chave: string): string {
  return dataDeChave(chave).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function dataPorExtenso(chave: string): string {
  return dataDeChave(chave).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function periodoPorExtenso(inicio: string, fim: string): string {
  if (inicio === fim) return dataPorExtenso(inicio);
  if (inicio.slice(0, 7) === fim.slice(0, 7)) {
    return `${diaDaChave(inicio)} a ${dataPorExtenso(fim)}`;
  }
  return `${dataPorExtenso(inicio)} a ${dataPorExtenso(fim)}`;
}

// ---------- Cartão de evento (lista e próximos) ----------

function CartaoEvento({
  n,
  compacto = false,
  aoAbrir,
}: {
  n: EventoNormalizado;
  compacto?: boolean;
  aoAbrir: (evento: EventoCalendario) => void;
}) {
  const { evento } = n;
  const selo = SELOS[evento.tipo];
  const mesmoDia = n.inicio === n.fim;
  return (
    <button
      type="button"
      className={`calendario-cartao agenda-tipo-${evento.tipo}${compacto ? ' calendario-cartao-compacto' : ''}`}
      onClick={() => aoAbrir(evento)}
    >
      <span className="calendario-cartao-data">
        <span className="calendario-cartao-dia">
          {mesmoDia ? diaDaChave(n.inicio) : `${diaDaChave(n.inicio)}-${diaDaChave(n.fim)}`}
        </span>
        <span className="calendario-cartao-mes">{mesCurtoDaChave(n.inicio)}</span>
      </span>
      <span className="calendario-cartao-texto">
        <span className="calendario-cartao-titulo">
          <span>{evento.titulo}</span>
          <Selo cor={selo.cor}>{selo.rotulo}</Selo>
        </span>
        {!compacto && evento.descricao && (
          <span className="calendario-cartao-descricao">{evento.descricao}</span>
        )}
        <span className="calendario-cartao-periodo">{periodoPorExtenso(n.inicio, n.fim)}</span>
      </span>
    </button>
  );
}

// ---------- Detalhe (dentro do Modal) ----------

function DetalheEvento({
  evento,
  mostrarEditar,
  mostrarExcluir,
  aoEditar,
  aoExcluir,
}: {
  evento: EventoCalendario;
  mostrarEditar: boolean;
  mostrarExcluir: boolean;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const selo = SELOS[evento.tipo];
  const inicio = chaveDoIso(evento.inicio);
  const fim = chaveDoIso(evento.fim);
  return (
    <div className={`calendario-detalhe agenda-tipo-${evento.tipo}`}>
      <div>
        <Selo cor={selo.cor}>{selo.rotulo}</Selo>
      </div>
      <p className="calendario-detalhe-periodo">
        <Icone nome="calendario" tamanho={18} />
        <span>{periodoPorExtenso(inicio, fim)}</span>
      </p>
      {evento.descricao && <p className="calendario-detalhe-descricao">{evento.descricao}</p>}
      {(mostrarEditar || mostrarExcluir) && (
        <div className="calendario-detalhe-acoes">
          {mostrarEditar && (
            <Botao variante="secundario" aoClicar={aoEditar}>
              Editar
            </Botao>
          )}
          {mostrarExcluir && (
            <Botao variante="perigo" aoClicar={aoExcluir}>
              Excluir
            </Botao>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Calendário ----------

export function Calendario({
  eventos,
  editavel = false,
  aoEditar,
  aoExcluir,
}: {
  eventos: EventoCalendario[];
  editavel?: boolean;
  aoEditar?: (evento: EventoCalendario) => void;
  aoExcluir?: (evento: EventoCalendario) => void;
}) {
  const hoje = chaveDeData(new Date());
  const [mes, setMes] = useState(() => {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), 1);
  });
  const [visao, setVisao] = useState<Visao>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches ? 'mes' : 'lista',
  );
  const [detalhe, setDetalhe] = useState<EventoCalendario | null>(null);

  // Datas convertidas uma vez por lista de eventos; ordenados pelo dia de início.
  const normalizados = useMemo<EventoNormalizado[]>(
    () =>
      eventos
        .map((evento) => ({ evento, inicio: chaveDoIso(evento.inicio), fim: chaveDoIso(evento.fim) }))
        .filter((n) => n.inicio !== '' && n.fim !== '')
        .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.evento.id - b.evento.id),
    [eventos],
  );

  const ano = mes.getFullYear();
  const indiceMes = mes.getMonth();
  const chaveMes = `${ano}-${dois(indiceMes + 1)}`;
  const diasNoMes = new Date(ano, indiceMes + 1, 0).getDate();
  const primeiroDia = chaveDeData(new Date(ano, indiceMes, 1));
  const ultimoDia = chaveDeData(new Date(ano, indiceMes, diasNoMes));
  // Semana começa na segunda: domingo (0) vira o 6º dia.
  const deslocamento = (new Date(ano, indiceMes, 1).getDay() + 6) % 7;
  const totalSemanas = Math.ceil((deslocamento + diasNoMes) / 7);
  const celulas = Array.from({ length: totalSemanas * 7 }, (_, i) =>
    chaveDeData(new Date(ano, indiceMes, 1 - deslocamento + i)),
  );

  const doMes = normalizados.filter((n) => n.inicio <= ultimoDia && n.fim >= primeiroDia);
  const proximos = normalizados.filter((n) => n.fim >= hoje).slice(0, PROXIMOS_TOTAL);

  function eventosDoDia(chave: string): EventoNormalizado[] {
    return normalizados.filter((n) => n.inicio <= chave && n.fim >= chave);
  }

  function mudarMes(delta: number) {
    setMes(new Date(ano, indiceMes + delta, 1));
  }

  function irParaHoje() {
    const agora = new Date();
    setMes(new Date(agora.getFullYear(), agora.getMonth(), 1));
  }

  function abrirDetalhe(evento: EventoCalendario) {
    setDetalhe(evento);
  }

  function fecharDetalhe() {
    setDetalhe(null);
  }

  const grade = (
    <div className="calendario-mes-cartao">
      <div className="calendario-grade">
        {DIAS_CABECALHO.map((dia) => (
          <div key={dia} className="calendario-dia-semana">
            {dia}
          </div>
        ))}
        {celulas.map((chave) => {
          const doDia = eventosDoDia(chave);
          const foraDoMes = chave.slice(0, 7) !== chaveMes;
          const ehHoje = chave === hoje;
          const mostrar = doDia.length > LIMITE_FAIXAS ? doDia.slice(0, LIMITE_FAIXAS - 1) : doDia;
          const restantes = doDia.length - mostrar.length;
          return (
            <div key={chave} className={`calendario-dia${foraDoMes ? ' calendario-dia-fora' : ''}`}>
              <span className={`calendario-dia-numero${ehHoje ? ' calendario-dia-hoje' : ''}`}>
                {diaDaChave(chave)}
              </span>
              {mostrar.map((n) => (
                <button
                  key={n.evento.id}
                  type="button"
                  className={`calendario-faixa agenda-tipo-${n.evento.tipo}`}
                  title={n.evento.titulo}
                  aria-label={`${n.evento.titulo}, ${SELOS[n.evento.tipo].rotulo}`}
                  onClick={() => abrirDetalhe(n.evento)}
                >
                  <span className="calendario-faixa-texto">{n.evento.titulo}</span>
                </button>
              ))}
              {restantes > 0 && (
                <button
                  type="button"
                  className="calendario-mais"
                  onClick={() => setVisao('lista')}
                  aria-label={`Mais ${restantes} evento${restantes > 1 ? 's' : ''} neste dia, ver na lista`}
                >
                  +{restantes}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const lista =
    doMes.length === 0 ? (
      <p className="agenda-vazia">Nenhum evento neste mês.</p>
    ) : (
      <div className="calendario-lista">
        {doMes.map((n) => (
          <CartaoEvento key={n.evento.id} n={n} aoAbrir={abrirDetalhe} />
        ))}
      </div>
    );

  return (
    <div className="calendario">
      <div className="barra-ferramentas calendario-barra">
        <div className="calendario-navegacao">
          <button type="button" className="calendario-seta" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
            <Icone nome="chevron-baixo" tamanho={18} className="calendario-seta-esquerda" />
          </button>
          <h2 className="calendario-titulo" aria-live="polite">
            {rotuloMes(mes)}
          </h2>
          <button type="button" className="calendario-seta" aria-label="Próximo mês" onClick={() => mudarMes(1)}>
            <Icone nome="chevron-baixo" tamanho={18} className="calendario-seta-direita" />
          </button>
          <button type="button" className="calendario-hoje" onClick={irParaHoje}>
            Hoje
          </button>
        </div>
        <div className="calendario-segmentado" role="group" aria-label="Modo de exibição">
          <button
            type="button"
            className="calendario-segmento"
            aria-pressed={visao === 'mes'}
            onClick={() => setVisao('mes')}
          >
            Mês
          </button>
          <button
            type="button"
            className="calendario-segmento"
            aria-pressed={visao === 'lista'}
            onClick={() => setVisao('lista')}
          >
            Lista
          </button>
        </div>
      </div>

      <div className="calendario-corpo">
        <div className="calendario-principal">{visao === 'mes' ? grade : lista}</div>

        <aside className="calendario-lateral">
          <Cartao titulo="Próximos eventos">
            {proximos.length === 0 ? (
              <p className="agenda-vazia">Nenhum evento a partir de hoje.</p>
            ) : (
              <div className="calendario-proximos">
                {proximos.map((n) => (
                  <CartaoEvento key={n.evento.id} n={n} compacto aoAbrir={abrirDetalhe} />
                ))}
              </div>
            )}
            <ul className="calendario-legenda" aria-label="Legenda dos tipos">
              {ORDEM_TIPOS.map((tipo) => (
                <li key={tipo} className={`agenda-tipo-${tipo}`}>
                  <span className="calendario-legenda-cor" aria-hidden="true" />
                  {SELOS[tipo].rotulo}
                </li>
              ))}
            </ul>
          </Cartao>
        </aside>
      </div>

      <Modal
        aberto={detalhe !== null}
        titulo={detalhe?.titulo ?? 'Evento'}
        aoFechar={fecharDetalhe}
      >
        {detalhe && (
          <DetalheEvento
            evento={detalhe}
            mostrarEditar={editavel && aoEditar !== undefined}
            mostrarExcluir={editavel && aoExcluir !== undefined}
            aoEditar={() => {
              const alvo = detalhe;
              fecharDetalhe();
              aoEditar?.(alvo);
            }}
            aoExcluir={() => {
              if (!window.confirm(`Excluir o evento "${detalhe.titulo}"?`)) return;
              const alvo = detalhe;
              fecharDetalhe();
              aoExcluir?.(alvo);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
