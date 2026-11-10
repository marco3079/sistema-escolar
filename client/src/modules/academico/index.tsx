import type { RotaModulo } from '../../lib/rotas';
import { Cursos } from './cursos';
import { Periodos } from './periodos';
import { MinhasTurmas, Turmas } from './turmas';

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/cursos',
    rotulo: 'Cursos',
    icone: '🏫',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Cursos />,
    ordem: 20,
  },
  {
    caminho: '/admin/periodos',
    rotulo: 'Períodos letivos',
    icone: '🗓️',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Periodos />,
    ordem: 21,
  },
  {
    caminho: '/admin/turmas',
    rotulo: 'Turmas',
    icone: '👥',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Turmas />,
    ordem: 22,
  },
  {
    caminho: '/professor/turmas',
    rotulo: 'Minhas turmas',
    icone: '👥',
    perfis: ['PROFESSOR'],
    elemento: <MinhasTurmas />,
    ordem: 10,
  },
];
