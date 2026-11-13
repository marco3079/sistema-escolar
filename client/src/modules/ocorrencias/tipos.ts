// Tipos e rótulos do módulo Ocorrências disciplinares (Contrato B, parte S2).

export type TipoOcorrencia = 'ADVERTENCIA' | 'SUSPENSAO' | 'INDISCIPLINA' | 'ATRASO' | 'OBSERVACAO' | 'ELOGIO';
export type GravidadeOcorrencia = 'LEVE' | 'MEDIA' | 'GRAVE';

// Item de GET /alunos/:alunoId/ocorrencias, GET /ocorrencias (em `itens`) e respostas de POST/PUT.
export interface OcorrenciaDTO {
  id: number;
  aluno: { id: number; nome: string; ra: string };
  turma: { id: number; codigo: string; disciplina: string } | null;
  autor: { id: number; nome: string };
  tipo: TipoOcorrencia;
  gravidade: GravidadeOcorrencia;
  titulo: string;
  descricao: string;
  medidas: string;
  data: string; // AAAA-MM-DD
  visivelFamilia: boolean;
  cienteEm: string | null;
  cientePor: { id: number; nome: string } | null;
  criadoEm: string;
  podeEditar: boolean;
  podeDarCiencia: boolean;
}

// Resposta de GET /ocorrencias
export interface PaginaOcorrencias {
  itens: OcorrenciaDTO[];
  total: number;
  pagina: number;
  porPagina: number;
}

// Resposta de GET /ocorrencias/resumo
export interface ResumoOcorrencias {
  ultimos30Dias: number;
  semCiencia: number;
  porTipo: Record<TipoOcorrencia, number>;
  porGravidade: Record<GravidadeOcorrencia, number>;
}

// Aluno como vem de GET /alunos?busca= (usado na escolha do aluno).
export interface AlunoBusca {
  id: number;
  ra: string;
  usuario: { id: number; nome: string };
}

export const TIPOS_OCORRENCIA: TipoOcorrencia[] = [
  'ADVERTENCIA',
  'SUSPENSAO',
  'INDISCIPLINA',
  'ATRASO',
  'OBSERVACAO',
  'ELOGIO',
];

export const GRAVIDADES_OCORRENCIA: GravidadeOcorrencia[] = ['LEVE', 'MEDIA', 'GRAVE'];

// Cores são variáveis de ui/estilo.css (texto do selo; o fundo sai de color-mix no CSS).
export const ROTULO_TIPO: Record<TipoOcorrencia, string> = {
  ADVERTENCIA: 'Advertência',
  SUSPENSAO: 'Suspensão',
  INDISCIPLINA: 'Indisciplina',
  ATRASO: 'Atraso',
  OBSERVACAO: 'Observação',
  ELOGIO: 'Elogio',
};

export const COR_TIPO: Record<TipoOcorrencia, string> = {
  ADVERTENCIA: 'var(--cor-laranja)',
  SUSPENSAO: 'var(--cor-perigo)',
  INDISCIPLINA: 'var(--cor-roxo)',
  ATRASO: 'var(--cor-primaria)',
  OBSERVACAO: 'var(--cor-texto-suave)',
  ELOGIO: 'var(--cor-verde)',
};

export const ROTULO_GRAVIDADE: Record<GravidadeOcorrencia, string> = {
  LEVE: 'Leve',
  MEDIA: 'Média',
  GRAVE: 'Grave',
};

export const COR_GRAVIDADE: Record<GravidadeOcorrencia, string> = {
  LEVE: 'var(--cor-primaria)',
  MEDIA: 'var(--cor-laranja)',
  GRAVE: 'var(--cor-perigo)',
};

export const TITULO_MIN = 3;
export const TITULO_MAX = 120;
export const DESCRICAO_MAX = 4000;
export const MEDIDAS_MAX = 2000;

// Data de hoje no formato AAAA-MM-DD (horário local), para o padrão e a validação de "não aceita futuro".
export function hojeIso(): string {
  const d = new Date();
  const ano = String(d.getFullYear()).padStart(4, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
