import type { RotaModulo } from '../../lib/rotas';
import { Configuracoes } from './Configuracoes';
import './configuracoes.css';

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/configuracoes',
    rotulo: 'Configurações',
    icone: 'engrenagem',
    perfis: ['ADMIN'],
    elemento: <Configuracoes />,
    ordem: 97,
  },
];
