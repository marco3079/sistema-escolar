import type { HorarioDTO } from './tipos';
import { DIAS_SEMANA } from './tipos';
import './agenda.css';

function BlocoAula({ horario }: { horario: HorarioDTO }) {
  const { turma } = horario;
  const sala = horario.sala || turma.sala || 'não definida';
  return (
    <article className="aula">
      <div className="aula-hora">
        {horario.horaInicio} às {horario.horaFim}
      </div>
      <div className="aula-disciplina">{turma.disciplina.nome}</div>
      <div className="aula-detalhe">
        Turma {turma.codigo}
        {turma.grupo ? ` (${turma.grupo})` : ''}
      </div>
      <div className="aula-detalhe">Sala: {sala}</div>
      <div className="aula-detalhe">Professor: {turma.professor.usuario.nome}</div>
    </article>
  );
}

// Mostra a semana em colunas a partir de 720 px e uma lista agrupada por dia abaixo disso.
export function GradeHorario({ horarios }: { horarios: HorarioDTO[] }) {
  if (horarios.length === 0) {
    return <p className="agenda-vazia">Nenhum horário cadastrado.</p>;
  }

  const diasComAula = new Set(horarios.map((h) => h.diaSemana));
  // Segunda a sábado sempre; domingo só se houver aula.
  const dias = DIAS_SEMANA.filter((d) => d.valor <= 6 || diasComAula.has(d.valor));

  const aulasDo = (diaSemana: number): HorarioDTO[] =>
    horarios
      .filter((h) => h.diaSemana === diaSemana)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  return (
    <>
      <div
        className="grade-semana"
        style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}
      >
        {dias.map((d) => (
          <div className="grade-dia" key={d.valor}>
            <h3 className="grade-dia-titulo">{d.rotulo}</h3>
            {aulasDo(d.valor).map((h) => (
              <BlocoAula key={h.id} horario={h} />
            ))}
          </div>
        ))}
      </div>

      <div className="grade-lista">
        {dias
          .filter((d) => aulasDo(d.valor).length > 0)
          .map((d) => (
            <section className="grade-lista-dia" key={d.valor}>
              <h3 className="grade-dia-titulo">{d.rotulo}</h3>
              {aulasDo(d.valor).map((h) => (
                <BlocoAula key={h.id} horario={h} />
              ))}
            </section>
          ))}
      </div>
    </>
  );
}
