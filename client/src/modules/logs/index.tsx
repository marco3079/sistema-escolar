import type { RotaModulo } from '../../lib/rotas';
import { Atividades } from './Atividades';
import { LogSistema } from './LogSistema';
import './logs.css';

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/atividades',
    rotulo: 'Atividades',
    icone: 'atividade',
    perfis: ['ADMIN'],
    elemento: <Atividades />,
    ordem: 95,
  },
  {
    caminho: '/admin/logs',
    rotulo: 'Log do sistema',
    icone: 'log',
    perfis: ['ADMIN'],
    elemento: <LogSistema />,
    ordem: 96,
  },
];
