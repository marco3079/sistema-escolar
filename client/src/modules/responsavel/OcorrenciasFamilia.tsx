import { useDados } from '../../lib/useDados';
import { Aviso, Carregando, Pagina } from '../../ui';
import { ListaOcorrencias } from '../ocorrencias/ListaOcorrencias';
import type { AlunoFamilia } from './tipos';
import './responsavel.css';

// Ocorrências de todos os alunos ligados ao responsável, agrupadas por aluno.
export function OcorrenciasFamilia() {
  const { dados, carregando, erro } = useDados<AlunoFamilia[]>('/familia/alunos');

  return (
    <Pagina titulo="Ocorrências">
      {carregando && !dados && <Carregando />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {dados && dados.length === 0 && (
        <Aviso tipo="info">Nenhum aluno ligado à sua conta. Procure a secretaria.</Aviso>
      )}

      {dados &&
        dados.map((a) => (
          <section key={a.alunoId} className="resp-bloco-aluno">
            <h2 className="resp-bloco-aluno-titulo">
              {a.nome} <span className="resp-suave">RA {a.ra}</span>
            </h2>
            <ListaOcorrencias alunoId={a.alunoId} modo="familia" />
          </section>
        ))}
    </Pagina>
  );
}
