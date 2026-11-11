import type { RotaModulo } from '../../lib/rotas';
import { Atendimento } from './Atendimento';

// O popup "Suporte" (meus chamados) fica no menu do usuário; aqui só a área de quem atende.
export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/atendimento',
    rotulo: 'Atendimento',
    icone: 'suporte',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Atendimento />,
    ordem: 81,
  },
  {
    caminho: '/professor/atendimento',
    rotulo: 'Atendimento',
    icone: 'suporte',
    perfis: ['PROFESSOR'],
    elemento: <Atendimento />,
    ordem: 81,
  },
];
