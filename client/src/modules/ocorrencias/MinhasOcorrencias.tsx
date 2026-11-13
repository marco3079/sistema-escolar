import { useAuth } from '../../lib/auth';
import { Aviso, Pagina } from '../../ui';
import { ListaOcorrencias } from './ListaOcorrencias';
import './ocorrencias.css';

// Ocorrências do próprio aluno (só leitura; ele pode dar ciência quando tiver 18 anos ou mais).
export function MinhasOcorrencias() {
  const { usuario } = useAuth();
  const alunoId = usuario?.alunoId ?? null;

  return (
    <Pagina titulo="Ocorrências">
      {alunoId === null ? (
        <Aviso tipo="erro">Sua conta não está ligada a um aluno.</Aviso>
      ) : (
        <ListaOcorrencias alunoId={alunoId} modo="familia" />
      )}
    </Pagina>
  );
}
