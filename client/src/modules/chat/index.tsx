import type { RotaModulo } from '../../lib/rotas';
import { Chat } from './Chat';

// Chat privado em cada portal. Todos os perfis participam; o portal define só o caminho.
// O menu mostra "Chat" (grupo "Comunidade"); o botão com contador no topo leva a esta tela.
export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/chat',
    rotulo: 'Chat',
    icone: 'chat',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Chat />,
    ordem: 58,
  },
  {
    caminho: '/professor/chat',
    rotulo: 'Chat',
    icone: 'chat',
    perfis: ['PROFESSOR'],
    elemento: <Chat />,
    ordem: 58,
  },
  {
    caminho: '/aluno/chat',
    rotulo: 'Chat',
    icone: 'chat',
    perfis: ['ALUNO'],
    elemento: <Chat />,
    ordem: 58,
  },
  {
    caminho: '/responsavel/chat',
    rotulo: 'Chat',
    icone: 'chat',
    perfis: ['RESPONSAVEL'],
    elemento: <Chat />,
    ordem: 58,
  },
];
