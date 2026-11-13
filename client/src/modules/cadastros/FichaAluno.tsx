import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDados } from '../../lib/useDados';
import { useAuth } from '../../lib/auth';
import { rotuloNivel } from '../../lib/tipos';
import { Aviso, Carregando, Selo, formatarData, formatarMoeda } from '../../ui';
import { ListaOcorrencias } from '../ocorrencias/ListaOcorrencias';
import { ResponsaveisDoAluno } from '../responsavel/ResponsaveisDoAluno';
import { BotaoPdf } from '../documentos/BotaoPdf';
import type { FichaAlunoDTO } from './tipos';
import {
  FichaCabecalho,
  FichaIndicador,
  FichaItem,
  FichaLinha,
  FichaModal,
  FichaSecao,
  STATUS_INSCRICAO,
  STATUS_MATRICULA,
  STATUS_MENSALIDADE,
  STATUS_PROJETO,
  SeloStatus,
  formatarNota,
  formatarPercentual,
} from './FichaComum';

const LIMITE_DISCIPLINAS = 8;

// Situação de um empréstimo: devolvido, atrasado ou no prazo.
function situacaoEmprestimo(e: FichaAlunoDTO['emprestimos'][number]) {
  if (e.devolvidoEm) return <Selo cor="verde">Devolvido</Selo>;
  if (e.atrasado) return <Selo cor="vermelho">Atrasado</Selo>;
  return <Selo cor="azul">No prazo</Selo>;
}

function Conteudo({
  ficha,
  aoEditar,
}: {
  ficha: FichaAlunoDTO;
  aoEditar: () => void;
}) {
  const [verTodas, setVerTodas] = useState(false);
  const { aluno, indicadores } = ficha;
  const temResponsavel = !!(aluno.responsavelNome || aluno.responsavelTelefone || aluno.responsavelEmail);
  const disciplinas = verTodas ? ficha.disciplinas : ficha.disciplinas.slice(0, LIMITE_DISCIPLINAS);
  const { usuario } = useAuth();
  // Responsáveis e ficha em PDF: só administração e secretaria (TI aparece como ADMIN).
  const ehGestao = usuario?.perfil === 'ADMIN' || usuario?.perfil === 'SECRETARIA';

  return (
    <>
      <FichaCabecalho
        nome={aluno.nome}
        subtitulo={`RA ${aluno.ra} · ${aluno.idade} anos`}
        ativo={aluno.ativo}
        aoEditar={aoEditar}
      />

      {ehGestao && (
        <div className="ocor-ficha-pdf">
          <BotaoPdf
            caminho={`/documentos/ficha/${aluno.id}`}
            nomeArquivo={`ficha-${aluno.ra}.pdf`}
            rotulo="Ficha em PDF"
            variante="secundario"
          />
        </div>
      )}

      <div className="ficha-indicadores">
        <FichaIndicador
          icone="biblioteca"
          cor="azul"
          valor={indicadores.disciplinasCursando}
          rotulo="Disciplinas cursando"
        />
        <FichaIndicador
          icone="boletim"
          cor="roxo"
          valor={formatarNota(indicadores.mediaGeral)}
          rotulo="Média geral"
        />
        <FichaIndicador
          icone="grafico"
          cor="verde"
          valor={formatarPercentual(indicadores.frequenciaMedia)}
          rotulo="Frequência média"
        />
        <FichaIndicador
          icone="financeiro"
          cor="laranja"
          valor={indicadores.mensalidadesEmAberto}
          rotulo="Mensalidades em aberto"
          detalhe={formatarMoeda(indicadores.valorEmAberto)}
        />
        <FichaIndicador
          icone="diario"
          cor="azul"
          valor={indicadores.emprestimosAtivos}
          rotulo="Empréstimos ativos"
        />
      </div>

      <div className="ficha-colunas">
        <div className="ficha-coluna">
          <FichaSecao titulo="Dados pessoais" icone="perfil">
            <FichaLinha rotulo="E-mail" valor={aluno.email} />
            <FichaLinha rotulo="Telefone" valor={aluno.telefone} />
            <FichaLinha rotulo="CPF" valor={aluno.cpf} />
            <FichaLinha rotulo="Nascimento" valor={formatarData(aluno.dataNascimento)} />
            <FichaLinha rotulo="Endereço" valor={aluno.endereco} />
            <FichaLinha rotulo="Cadastrado em" valor={formatarData(aluno.criadoEm)} />
          </FichaSecao>

          {temResponsavel && (
            <FichaSecao titulo="Responsável" icone="usuarios">
              <FichaLinha rotulo="Nome" valor={aluno.responsavelNome} />
              <FichaLinha rotulo="Telefone" valor={aluno.responsavelTelefone} />
              <FichaLinha rotulo="E-mail" valor={aluno.responsavelEmail} />
            </FichaSecao>
          )}

          <FichaSecao titulo="Matrículas" icone="matriculas">
            {ficha.matriculas.length === 0 && <p className="ficha-vazio">Nenhuma matrícula.</p>}
            {ficha.matriculas.map((m) => (
              <FichaItem
                key={m.id}
                titulo={m.curso.nome}
                selo={<SeloStatus valor={m.status} mapa={STATUS_MATRICULA} />}
              >
                {rotuloNivel(m.curso.nivel)} ·{' '}
                {m.curso.regime === 'SERIADO' ? `Série ${m.serieAtual}` : 'Por créditos'} · Ingresso{' '}
                {m.periodoIngresso}
              </FichaItem>
            ))}
          </FichaSecao>

          <FichaSecao titulo="Ocorrências" icone="ocorrencia">
            <ListaOcorrencias alunoId={aluno.id} modo="gestao" />
          </FichaSecao>

          {ehGestao && (
            <FichaSecao titulo="Responsáveis" icone="familia">
              <ResponsaveisDoAluno alunoId={aluno.id} />
            </FichaSecao>
          )}
        </div>

        <div className="ficha-coluna">
          <FichaSecao titulo="Disciplinas" icone="turmas">
            {ficha.disciplinas.length === 0 && <p className="ficha-vazio">Nenhuma disciplina.</p>}
            {disciplinas.map((d) => (
              <FichaItem
                key={d.inscricaoId}
                titulo={d.disciplina}
                selo={<SeloStatus valor={d.status} mapa={STATUS_INSCRICAO} />}
              >
                Turma {d.turma} · {d.periodo}
                <br />
                Professor: {d.professor}
                <br />
                Nota {formatarNota(d.notaFinal)} · Frequência {formatarPercentual(d.frequencia)}
              </FichaItem>
            ))}
            {!verTodas && ficha.disciplinas.length > LIMITE_DISCIPLINAS && (
              <button type="button" className="ficha-mais" onClick={() => setVerTodas(true)}>
                Ver todas
              </button>
            )}
          </FichaSecao>

          {ficha.mensalidades.length > 0 && (
            <FichaSecao titulo="Mensalidades" icone="financeiro">
              {ficha.mensalidades.map((m) => (
                <FichaItem
                  key={m.id}
                  titulo={m.competencia}
                  selo={<SeloStatus valor={m.status} mapa={STATUS_MENSALIDADE} />}
                >
                  Vencimento {formatarData(m.vencimento)} · {formatarMoeda(m.valorFinal)}
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

          {ficha.projeto && (
            <FichaSecao titulo="Pesquisa" icone="pos">
              <FichaItem
                titulo={ficha.projeto.titulo}
                selo={<SeloStatus valor={ficha.projeto.status} mapa={STATUS_PROJETO} />}
              >
                Orientador: {ficha.projeto.orientador}
              </FichaItem>
            </FichaSecao>
          )}
        </div>
      </div>

      <footer className="ficha-rodape">
        <Link className="botao botao-secundario" to="/admin/boletins">
          Ver boletim
        </Link>
        <Link className="botao botao-secundario" to="/admin/matriculas">
          Matrículas
        </Link>
        <Link className="botao botao-secundario" to="/admin/financeiro">
          Financeiro
        </Link>
      </footer>
    </>
  );
}

export function FichaAluno({
  alunoId,
  aoFechar,
  aoEditar,
}: {
  alunoId: number;
  aoFechar: () => void;
  aoEditar: () => void;
}) {
  const { dados, carregando, erro } = useDados<FichaAlunoDTO>(`/alunos/${alunoId}/ficha`);

  return (
    <FichaModal aberto titulo="Ficha do aluno" aoFechar={aoFechar}>
      {carregando && <Carregando />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {dados && <Conteudo ficha={dados} aoEditar={aoEditar} />}
    </FichaModal>
  );
}
