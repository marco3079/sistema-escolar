import type { RotaModulo, RotaPublica } from '../../lib/rotas';
import { Acompanhar } from './Acompanhar';
import { Detalhe } from './Detalhe';
import { Fila } from './Fila';
import { MatriculaOnline } from './MatriculaOnline';
import { Rematricula } from './Rematricula';

// Matrícula e rematrícula online. As telas públicas (sem login) ficam em rotasPublicas.
// O envio de documentos (EnvioDocumentos) aparece dentro das telas públicas; não tem rota própria.

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/solicitacoes',
    rotulo: 'Matrícula online',
    icone: 'solicitacao',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Fila />,
    ordem: 40,
  },
  {
    caminho: '/admin/solicitacoes/:id',
    rotulo: 'Pedido',
    icone: 'solicitacao',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Detalhe />,
    menu: false,
  },
  {
    caminho: '/aluno/rematricula',
    rotulo: 'Rematrícula',
    icone: 'matriculas',
    perfis: ['ALUNO'],
    elemento: <Rematricula />,
    ordem: 45,
  },
  {
    caminho: '/responsavel/rematricula',
    rotulo: 'Rematrícula',
    icone: 'matriculas',
    perfis: ['RESPONSAVEL'],
    elemento: <Rematricula />,
    ordem: 45,
  },
];

export const rotasPublicas: RotaPublica[] = [
  {
    caminho: '/matricula-online',
    elemento: <MatriculaOnline />,
  },
  {
    caminho: '/matricula-online/acompanhar',
    elemento: <Acompanhar />,
  },
];
