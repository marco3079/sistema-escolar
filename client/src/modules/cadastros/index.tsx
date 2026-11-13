import type { RotaModulo } from '../../lib/rotas';
import { Alunos } from './alunos';
import { Professores } from './professores';
import { Usuarios } from './usuarios';
import { MeuPerfil } from './perfil';

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/alunos',
    rotulo: 'Alunos',
    icone: 'alunos',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Alunos />,
    ordem: 10,
  },
  {
    caminho: '/admin/professores',
    rotulo: 'Professores',
    icone: 'professores',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Professores />,
    ordem: 11,
  },
  {
    caminho: '/admin/usuarios',
    rotulo: 'Usuários',
    icone: 'usuarios',
    perfis: ['ADMIN'],
    elemento: <Usuarios />,
    ordem: 12,
  },
  {
    caminho: '/aluno/perfil',
    rotulo: 'Meu perfil',
    icone: 'perfil',
    perfis: ['ALUNO'],
    elemento: <MeuPerfil />,
    ordem: 90,
  },
  {
    caminho: '/admin/perfil',
    rotulo: 'Meu perfil',
    icone: 'perfil',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <MeuPerfil />,
    ordem: 90,
  },
  {
    caminho: '/professor/perfil',
    rotulo: 'Meu perfil',
    icone: 'perfil',
    perfis: ['PROFESSOR'],
    elemento: <MeuPerfil />,
    ordem: 90,
  },
  {
    caminho: '/responsavel/perfil',
    rotulo: 'Meu perfil',
    icone: 'perfil',
    perfis: ['RESPONSAVEL'],
    elemento: <MeuPerfil />,
    ordem: 90,
  },
];
