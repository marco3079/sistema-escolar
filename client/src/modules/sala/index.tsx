import type { RotaModulo } from '../../lib/rotas';
import type { Perfil } from '../../lib/tipos';
import { Andamento } from './Andamento';
import { MarcarPresenca } from './MarcarPresenca';
import { Sala } from './Sala';
import { Salas } from './Salas';
import './sala.css';

// Rotas da sala de aula em cada portal: a lista aparece no menu; a turma e a presença ficam sem menu.
function rotasDaSala(base: string, perfis: Perfil[]): RotaModulo[] {
  return [
    {
      caminho: `${base}/sala`,
      rotulo: 'Sala de aula',
      icone: 'sala',
      perfis,
      elemento: <Salas base={base} />,
      ordem: 39,
    },
    {
      caminho: `${base}/sala/:turmaId`,
      rotulo: 'Sala de aula',
      icone: 'sala',
      perfis,
      elemento: <Sala base={base} />,
      menu: false,
      ordem: 39,
    },
  ];
}

export const rotas: RotaModulo[] = [
  ...rotasDaSala('/admin', ['ADMIN', 'SECRETARIA']),
  ...rotasDaSala('/professor', ['PROFESSOR']),
  ...rotasDaSala('/aluno', ['ALUNO']),
  {
    caminho: '/admin/andamento',
    rotulo: 'Andamento das aulas',
    icone: 'plano',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Andamento />,
    ordem: 42,
  },
  {
    caminho: '/aluno/presenca',
    rotulo: 'Marcar presença',
    icone: 'qr',
    perfis: ['ALUNO'],
    elemento: <MarcarPresenca />,
    menu: false,
    ordem: 39,
  },
];
