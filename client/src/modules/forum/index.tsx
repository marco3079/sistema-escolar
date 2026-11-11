import type { RotaModulo } from '../../lib/rotas';
import type { Perfil } from '../../lib/tipos';
import { Feed } from './Feed';
import { PaginaPublicacao } from './PaginaPublicacao';
import './forum.css';

// Rotas do fórum em cada portal: o feed aparece no menu; comunidade e publicação ficam sem menu.
function rotasDoForum(base: string, perfis: Perfil[]): RotaModulo[] {
  return [
    {
      caminho: `${base}/forum`,
      rotulo: 'Fórum',
      icone: 'forum',
      perfis,
      elemento: <Feed />,
      ordem: 80,
    },
    {
      caminho: `${base}/forum/c/:slug`,
      rotulo: 'Fórum',
      icone: 'forum',
      perfis,
      elemento: <Feed />,
      menu: false,
      ordem: 80,
    },
    {
      caminho: `${base}/forum/p/:id`,
      rotulo: 'Publicação',
      icone: 'forum',
      perfis,
      elemento: <PaginaPublicacao />,
      menu: false,
      ordem: 80,
    },
  ];
}

export const rotas: RotaModulo[] = [
  ...rotasDoForum('/admin', ['ADMIN', 'SECRETARIA']),
  ...rotasDoForum('/professor', ['PROFESSOR']),
  ...rotasDoForum('/aluno', ['ALUNO']),
];
