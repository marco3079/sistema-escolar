import type { RotaModulo } from '../../lib/rotas';
import { MinhasOcorrencias } from './MinhasOcorrencias';
import { Ocorrencias } from './Ocorrencias';

// Ocorrências disciplinares: gestão (secretaria e administração), professor e aluno.
export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/ocorrencias',
    rotulo: 'Ocorrências',
    icone: 'ocorrencia',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Ocorrencias gestao />,
    ordem: 45,
  },
  {
    caminho: '/professor/ocorrencias',
    rotulo: 'Ocorrências',
    icone: 'ocorrencia',
    perfis: ['PROFESSOR'],
    elemento: <Ocorrencias gestao={false} />,
    ordem: 45,
  },
  {
    caminho: '/aluno/ocorrencias',
    rotulo: 'Ocorrências',
    icone: 'ocorrencia',
    perfis: ['ALUNO'],
    elemento: <MinhasOcorrencias />,
    ordem: 45,
  },
];
