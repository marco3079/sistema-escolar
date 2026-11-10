import { Painel } from '../../layout/Painel';
import type { RotaModulo } from '../../lib/rotas';

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin',
    rotulo: 'Início',
    icone: '🏠',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Painel />,
    ordem: 0,
  },
  {
    caminho: '/professor',
    rotulo: 'Início',
    icone: '🏠',
    perfis: ['PROFESSOR'],
    elemento: <Painel />,
    ordem: 0,
  },
  {
    caminho: '/aluno',
    rotulo: 'Início',
    icone: '🏠',
    perfis: ['ALUNO'],
    elemento: <Painel />,
    ordem: 0,
  },
];
