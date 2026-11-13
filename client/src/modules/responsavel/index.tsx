import type { RotaModulo } from '../../lib/rotas';
import { AlunoDetalhe } from './AlunoDetalhe';
import { Inicio } from './Inicio';
import { OcorrenciasFamilia } from './OcorrenciasFamilia';
import { Responsaveis } from './Responsaveis';
import './responsavel.css';

// Portal dos responsáveis (perfil RESPONSAVEL) e a lista de responsáveis da gestão.
export const rotas: RotaModulo[] = [
  {
    caminho: '/responsavel',
    rotulo: 'Início',
    icone: 'inicio',
    perfis: ['RESPONSAVEL'],
    elemento: <Inicio />,
    ordem: 0,
  },
  {
    caminho: '/responsavel/aluno/:alunoId',
    rotulo: 'Aluno',
    icone: 'alunos',
    perfis: ['RESPONSAVEL'],
    elemento: <AlunoDetalhe />,
    menu: false,
  },
  {
    caminho: '/responsavel/ocorrencias',
    rotulo: 'Ocorrências',
    icone: 'ocorrencia',
    perfis: ['RESPONSAVEL'],
    elemento: <OcorrenciasFamilia />,
  },
  {
    caminho: '/admin/responsaveis',
    rotulo: 'Responsáveis',
    icone: 'familia',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Responsaveis />,
  },
];
