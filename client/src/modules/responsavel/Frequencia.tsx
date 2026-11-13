import { useDados } from '../../lib/useDados';
import { Aviso, Carregando, formatarData } from '../../ui';
import type { FrequenciaDisciplina } from './tipos';
import { FREQUENCIA_MINIMA, formatarPercentualFamilia, limitarPercentual } from './tipos';
import './responsavel.css';

function CartaoFrequencia({ item }: { item: FrequenciaDisciplina }) {
  const semAulas = item.percentual === null;
  const baixa = item.percentual !== null && item.percentual < FREQUENCIA_MINIMA;

  return (
    <article className="resp-disciplina">
      <header className="resp-disciplina-topo">
        <div className="resp-disciplina-titulo">
          <h3>{item.disciplina}</h3>
          <p className="resp-suave">Turma {item.turma}</p>
        </div>
      </header>

      <div className="resp-medidor">
        <span className="resp-medidor-rotulo">Frequência</span>
        <span className={`resp-medidor-valor ${baixa ? 'resp-texto-perigo' : ''}`}>
          {formatarPercentualFamilia(item.percentual)}
        </span>
        <div
          className="resp-barra"
          role="img"
          aria-label={semAulas ? 'Nenhuma aula registrada' : `Frequência ${formatarPercentualFamilia(item.percentual)}`}
        >
          {!semAulas && (
            <span
              className={`resp-barra-preenchimento ${baixa ? 'resp-barra-baixa' : 'resp-barra-ok'}`}
              style={{ width: `${limitarPercentual(item.percentual ?? 0)}%` }}
            />
          )}
          <span className="resp-marcador" style={{ left: `${FREQUENCIA_MINIMA}%` }} />
        </div>
        {baixa && <p className="resp-suave resp-texto-perigo">Abaixo do mínimo de {FREQUENCIA_MINIMA}%.</p>}
      </div>

      <p className="resp-suave">
        Aulas {item.aulas} · Presenças {item.presencas} · Faltas {item.faltas}
      </p>

      {item.ultimasFaltas.length > 0 && (
        <div>
          <p className="resp-suave">Últimas faltas:</p>
          <ul className="resp-faltas">
            {item.ultimasFaltas.map((data) => (
              <li key={data}>{formatarData(data)}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

// Frequência por disciplina do período mais recente (somente leitura).
export function Frequencia({ alunoId }: { alunoId: number }) {
  const { dados, carregando, erro } = useDados<FrequenciaDisciplina[]>(`/familia/alunos/${alunoId}/frequencia`);

  if (carregando && !dados) return <Carregando />;
  if (erro && !dados) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;

  if (dados.length === 0) {
    return <Aviso tipo="info">Nenhuma inscrição em disciplinas no período mais recente.</Aviso>;
  }

  return (
    <div className="resp-visao">
      <p className="resp-suave">
        Frequência mínima para aprovação: {FREQUENCIA_MINIMA}%. Valores abaixo disso aparecem em vermelho.
      </p>
      <div className="resp-disciplinas">
        {dados.map((d) => (
          <CartaoFrequencia key={d.turmaId} item={d} />
        ))}
      </div>
    </div>
  );
}
