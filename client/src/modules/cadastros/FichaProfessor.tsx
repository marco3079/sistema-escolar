import { Link } from 'react-router-dom';
import { useDados } from '../../lib/useDados';
import { Aviso, Carregando, Selo, formatarData } from '../../ui';
import type { FichaProfessorDTO } from './tipos';
import { rotuloTitulacao } from './tipos';
import {
  DIAS_SEMANA_LONGO,
  FichaCabecalho,
  FichaIndicador,
  FichaItem,
  FichaLinha,
  FichaModal,
  FichaSecao,
  ROTULO_BANCA_TIPO,
  STATUS_BANCA_RESULTADO,
  SeloStatus,
  formatarHoras,
  formatarNota,
  formatarPercentual,
} from './FichaComum';

// Situação de um empréstimo: devolvido, atrasado ou no prazo.
function situacaoEmprestimo(e: FichaProfessorDTO['emprestimos'][number]) {
  if (e.devolvidoEm) return <Selo cor="verde">Devolvido</Selo>;
  if (e.atrasado) return <Selo cor="vermelho">Atrasado</Selo>;
  return <Selo cor="azul">No prazo</Selo>;
}

// Agrupa os horários por dia da semana (1 = segunda ... 7 = domingo), em ordem.
function horariosPorDia(horarios: FichaProfessorDTO['horarios']) {
  const grupos = new Map<number, FichaProfessorDTO['horarios']>();
  const ordenados = [...horarios].sort(
    (a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio)
  );
  for (const h of ordenados) {
    const lista = grupos.get(h.diaSemana) ?? [];
    lista.push(h);
    grupos.set(h.diaSemana, lista);
  }
  return [...grupos.entries()];
}

function Conteudo({
  ficha,
  aoEditar,
}: {
  ficha: FichaProfessorDTO;
  aoEditar: () => void;
}) {
  const { professor, indicadores } = ficha;
  const grupos = horariosPorDia(ficha.horarios);

  return (
    <>
      <FichaCabecalho
        nome={professor.nome}
        subtitulo={`Registro ${professor.registro} · ${rotuloTitulacao(professor.titulacao)}`}
        detalhe={professor.area ?? undefined}
        ativo={professor.ativo}
        aoEditar={aoEditar}
      />

      <div className="ficha-indicadores">
        <FichaIndicador icone="turmas" cor="azul" valor={indicadores.turmasAtivas} rotulo="Turmas ativas" />
        <FichaIndicador icone="alunos" cor="roxo" valor={indicadores.alunos} rotulo="Alunos" />
        <FichaIndicador icone="pos" cor="verde" valor={indicadores.orientacoes} rotulo="Orientações" />
        <FichaIndicador
          icone="horarios"
          cor="laranja"
          valor={formatarHoras(indicadores.cargaSemanalHoras)}
          rotulo="Carga semanal"
        />
        <FichaIndicador
          icone="boletim"
          cor="azul"
          valor={formatarNota(indicadores.mediaDasTurmas)}
          rotulo="Média das turmas"
        />
        <FichaIndicador
          icone="grafico"
          cor="verde"
          valor={formatarPercentual(indicadores.frequenciaMedia)}
          rotulo="Frequência média"
        />
      </div>

      <div className="ficha-colunas">
        <div className="ficha-coluna">
          <FichaSecao titulo="Dados pessoais" icone="perfil">
            <FichaLinha rotulo="E-mail" valor={professor.email} />
            <FichaLinha rotulo="Telefone" valor={professor.telefone} />
            <FichaLinha rotulo="CPF" valor={professor.cpf} />
            <FichaLinha rotulo="Cadastrado em" valor={formatarData(professor.criadoEm)} />
          </FichaSecao>

          <FichaSecao titulo="Horário semanal" icone="horarios">
            {grupos.length === 0 && <p className="ficha-vazio">Sem horários cadastrados</p>}
            {grupos.map(([dia, aulas]) => (
              <div key={dia} className="ficha-dia">
                <h4 className="ficha-dia-titulo">{DIAS_SEMANA_LONGO[dia] ?? `Dia ${dia}`}</h4>
                {aulas.map((h, i) => (
                  <FichaItem key={i} titulo={`${h.horaInicio}–${h.horaFim}`}>
                    {h.disciplina} · Turma {h.turma}
                    {h.sala && <> · Sala {h.sala}</>}
                  </FichaItem>
                ))}
              </div>
            ))}
          </FichaSecao>
        </div>

        <div className="ficha-coluna">
          <FichaSecao titulo="Turmas" icone="turmas">
            {ficha.turmas.length === 0 && <p className="ficha-vazio">Nenhuma turma.</p>}
            {ficha.turmas.map((t) => (
              <FichaItem
                key={t.id}
                titulo={`${t.codigo} · ${t.disciplina}`}
                selo={!t.periodoAtivo ? <Selo cor="cinza">Encerrada</Selo> : undefined}
              >
                {t.curso} · {t.periodo}
                <br />
                Inscritos {t.inscritos}/{t.vagas}
                {t.sala && <> · Sala {t.sala}</>}
              </FichaItem>
            ))}
          </FichaSecao>

          {ficha.orientacoes.length > 0 && (
            <FichaSecao titulo="Orientações" icone="pos">
              {ficha.orientacoes.map((o) => (
                <FichaItem key={o.id} titulo={o.titulo} selo={<Selo cor="cinza">{o.status}</Selo>}>
                  Aluno: {o.aluno} · {o.curso}
                  <br />
                  Papel: {o.papel}
                </FichaItem>
              ))}
            </FichaSecao>
          )}

          {ficha.bancas.length > 0 && (
            <FichaSecao titulo="Bancas" icone="documento">
              {ficha.bancas.map((b) => (
                <FichaItem
                  key={b.id}
                  titulo={b.projeto}
                  selo={<SeloStatus valor={b.resultado} mapa={STATUS_BANCA_RESULTADO} />}
                >
                  {ROTULO_BANCA_TIPO[b.tipo] ?? b.tipo} · {formatarData(b.data)} · Papel: {b.papel}
                </FichaItem>
              ))}
            </FichaSecao>
          )}

          {ficha.emprestimos.length > 0 && (
            <FichaSecao titulo="Biblioteca" icone="biblioteca">
              {ficha.emprestimos.map((e) => (
                <FichaItem key={e.id} titulo={e.livro} selo={situacaoEmprestimo(e)}>
                  Retirada {formatarData(e.retiradoEm)} · Devolução prevista{' '}
                  {formatarData(e.devolucaoPrevista)}
                </FichaItem>
              ))}
            </FichaSecao>
          )}
        </div>
      </div>

      <footer className="ficha-rodape">
        <Link className="botao botao-secundario" to="/admin/turmas">
          Turmas
        </Link>
        <Link className="botao botao-secundario" to="/admin/horarios">
          Horários
        </Link>
        <Link className="botao botao-secundario" to="/admin/pos">
          Pós-graduação
        </Link>
      </footer>
    </>
  );
}

export function FichaProfessor({
  professorId,
  aoFechar,
  aoEditar,
}: {
  professorId: number;
  aoFechar: () => void;
  aoEditar: () => void;
}) {
  const { dados, carregando, erro } = useDados<FichaProfessorDTO>(`/professores/${professorId}/ficha`);

  return (
    <FichaModal aberto titulo="Ficha do professor" aoFechar={aoFechar}>
      {carregando && <Carregando />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {dados && <Conteudo ficha={dados} aoEditar={aoEditar} />}
    </FichaModal>
  );
}
