import type { RotaModulo, RotaPublica } from '../../lib/rotas';
import { Validar } from './Validar';
import './documentos.css';

// Os componentes de PDF (BotaoPdf, DocumentosEmitidos) são usados por outros módulos.
// Este módulo só registra as telas públicas de conferência.
export const rotas: RotaModulo[] = [];

export const rotasPublicas: RotaPublica[] = [
  { caminho: '/validar', elemento: <Validar /> },
  { caminho: '/validar/:codigo', elemento: <Validar /> },
];
