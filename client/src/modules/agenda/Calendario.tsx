import { Botao, Selo, formatarData, paraInputData } from '../../ui';
import type { ReactNode } from 'react';
import type { EventoCalendario, TipoEvento } from './tipos';
import './agenda.css';

const SELOS: Record<TipoEvento, { rotulo: string; cor: 'azul' | 'vermelho' | 'amarelo' | 'verde' | 'cinza' }> = {
  LETIVO: { rotulo: 'Letivo', cor: 'azul' },
  FERIADO: { rotulo: 'Feriado', cor: 'vermelho' },
  PROVA: { rotulo: 'Prova', cor: 'amarelo' },
  EVENTO: { rotulo: 'Evento', cor: 'verde' },
  RECESSO: { rotulo: 'Recesso', cor: 'cinza' },
};

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-');
  const texto = new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function periodoDoEvento(evento: EventoCalendario): string {
  const inicio = formatarData(evento.inicio);
  if (paraInputData(evento.inicio) === paraInputData(evento.fim)) return inicio;
  return `${inicio} a ${formatarData(evento.fim)}`;
}

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
  if (eventos.length === 0) {
    return <p className="agenda-vazia">Nenhum evento no calendário.</p>;
  }

  // Agrupa por mês ("AAAA-MM") pela data de início, na ordem cronológica.
  const ordenados = [...eventos].sort(
    (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
  );
  const grupos = new Map<string, EventoCalendario[]>();
  for (const evento of ordenados) {
    const chave = paraInputData(evento.inicio).slice(0, 7);
    const lista = grupos.get(chave) ?? [];
    lista.push(evento);
    grupos.set(chave, lista);
  }

  const blocos: ReactNode[] = [];
  for (const [chave, lista] of grupos) {
    blocos.push(
      <section className="calendario-mes" key={chave}>
        <h3 className="calendario-mes-titulo">{rotuloMes(chave)}</h3>
        {lista.map((evento) => {
          const selo = SELOS[evento.tipo];
          return (
            <div className="calendario-evento" key={evento.id}>
              <div className="calendario-evento-info">
                <div className="calendario-evento-data">{periodoDoEvento(evento)}</div>
                <div className="calendario-evento-titulo">
                  <Selo cor={selo.cor}>{selo.rotulo}</Selo> {evento.titulo}
                </div>
                {evento.descricao && (
                  <div className="calendario-evento-descricao">{evento.descricao}</div>
                )}
              </div>
              {editavel && (
                <div className="calendario-acoes">
                  {aoEditar && (
                    <Botao variante="secundario" aoClicar={() => aoEditar(evento)}>
                      Editar
                    </Botao>
                  )}
                  {aoExcluir && (
                    <Botao variante="perigo" aoClicar={() => aoExcluir(evento)}>
                      Excluir
                    </Botao>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>,
    );
  }

  return <div className="calendario">{blocos}</div>;
}
