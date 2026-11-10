import type { RotaModulo } from '../../lib/rotas';
import { Alunos } from './alunos';
import { Professores } from './professores';
import { Usuarios } from './usuarios';
import { MeuPerfil } from './perfil';

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/alunos',
    rotulo: 'Alunos',
    icone: '🎓',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Alunos />,
    ordem: 10,
  },
  {
    caminho: '/admin/professores',
    rotulo: 'Professores',
    icone: '👩‍🏫',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Professores />,
    ordem: 11,
  },
  {
    caminho: '/admin/usuarios',
    rotulo: 'Usuários',
    icone: '🔑',
    perfis: ['ADMIN'],
    elemento: <Usuarios />,
    ordem: 12,
  },
  {
    caminho: '/aluno/perfil',
    rotulo: 'Meu perfil',
    icone: '👤',
    perfis: ['ALUNO'],
    elemento: <MeuPerfil />,
    ordem: 90,
  },
  {
    caminho: '/professor/perfil',
    rotulo: 'Meu perfil',
    icone: '👤',
    perfis: ['PROFESSOR'],
    elemento: <MeuPerfil />,
    ordem: 90,
  },
];
