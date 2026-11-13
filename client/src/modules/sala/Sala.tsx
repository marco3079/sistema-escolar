import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDados } from '../../lib/useDados';
import { Abas, Aviso, Carregando, Pagina } from '../../ui';
import { AbaChamada } from './Chamada';
import type { PropsAba, SalaDetalhe } from './comum';
import { Materiais } from './Materiais';
import { Plano } from './Plano';
import { AbaProvas } from './Provas';
import { AbaTarefas } from './Tarefas';
import './sala.css';

// Tela de uma turma: cabeçalho e abas. A aba ativa fica na query (?aba=tarefas) para os links dos avisos.
export function Sala({ base }: { base: string }) {
  const { turmaId: turmaParam = '' } = useParams<{ turmaId: string }>();
  const turmaId = Number(turmaParam);
  const valida = Number.isInteger(turmaId) && turmaId > 0;
  const { dados, carregando, erro } = useDados<SalaDetalhe>(valida ? `/salas/${turmaId}` : null);
  const [params, setParams] = useSearchParams();

  if (!valida) {
    return (
      <Pagina titulo="Sala de aula">
        <Aviso tipo="erro">Turma não encontrada.</Aviso>
      </Pagina>
    );
  }

  if (!dados) {
    return (
      <Pagina titulo="Sala de aula" acoes={<Link className="botao botao-secundario" to={`${base}/sala`}>Voltar</Link>}>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : carregando && <Carregando />}
      </Pagina>
    );
  }

  const abas = [
    { id: 'materiais', rotulo: 'Materiais' },
    { id: 'plano', rotulo: 'Plano de aula' },
    { id: 'tarefas', rotulo: 'Tarefas' },
    { id: 'provas', rotulo: 'Provas' },
    ...(dados.podeEditar ? [{ id: 'chamada', rotulo: 'Chamada' }] : []),
  ];
  const pedida = params.get('aba') ?? '';
  const ativa = abas.some((a) => a.id === pedida) ? pedida : 'materiais';

  const props: PropsAba = {
    turmaId,
    papel: dados.papel,
    podeEditar: dados.podeEditar,
    base,
  };

  const acoes = (
    <>
      {dados.papel === 'ALUNO' && (
        <Link className="botao botao-primario" to="/aluno/presenca">
          Marcar presença
        </Link>
      )}
      <Link className="botao botao-secundario" to={`${base}/sala`}>
        Voltar
      </Link>
    </>
  );

  return (
    <Pagina titulo={dados.disciplina.nome} acoes={acoes}>
      <div className="sala-cabecalho">
        <p className="sala-cabecalho-linha">
          <span className="sala-codigo">{dados.codigo}</span>
          <span>{dados.disciplina.codigo}</span>
          <span>{dados.periodoLetivo.nome}</span>
        </p>
        <p className="sala-cabecalho-linha">
          <span>Professor: {dados.professor.nome}</span>
          <span>
            {dados.alunos} {dados.alunos === 1 ? 'aluno' : 'alunos'}
          </span>
        </p>
      </div>

      <div className="sala-abas">
        <Abas abas={abas} ativa={ativa} aoMudar={(id) => setParams({ aba: id })} />
      </div>

      {ativa === 'materiais' && <Materiais {...props} />}
      {ativa === 'plano' && <Plano {...props} />}
      {ativa === 'tarefas' && <AbaTarefas {...props} />}
      {ativa === 'provas' && <AbaProvas {...props} />}
      {ativa === 'chamada' && dados.podeEditar && <AbaChamada {...props} />}
    </Pagina>
  );
}
