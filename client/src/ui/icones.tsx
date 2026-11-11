import type { ReactNode } from 'react';

export type NomeIcone =
  | 'inicio' | 'alunos' | 'professores' | 'usuarios' | 'cursos' | 'periodos' | 'turmas'
  | 'matriculas' | 'diario' | 'boletim' | 'historico' | 'pos' | 'financeiro' | 'biblioteca'
  | 'horarios' | 'calendario' | 'comunicados' | 'perfil' | 'menu' | 'mais' | 'sair' | 'fechar';

export const NOMES_ICONES: NomeIcone[] = [
  'inicio', 'alunos', 'professores', 'usuarios', 'cursos', 'periodos', 'turmas',
  'matriculas', 'diario', 'boletim', 'historico', 'pos', 'financeiro', 'biblioteca',
  'horarios', 'calendario', 'comunicados', 'perfil', 'menu', 'mais', 'sair', 'fechar',
];

// Desenhos em grade 24 x 24 (área útil 3 a 21). Herdam o traço do <svg> pai.
const DESENHOS: Record<NomeIcone, ReactNode> = {
  // Casa: telhado em V invertido e corpo com porta.
  inicio: (
    <>
      <polyline points="3 11 12 3.5 21 11" />
      <path d="M5.5 9.5V20.5H18.5V9.5" />
      <path d="M10 20.5V15H14V20.5" />
    </>
  ),

  // Capelo: losango visto de cima, base abaixo e borla do lado direito.
  alunos: (
    <>
      <polygon points="3 9.5 12 4.5 21 9.5 12 14.5" />
      <path d="M7 12V16.5C7 18 9.2 19 12 19C14.8 19 17 18 17 16.5V12" />
      <line x1="19.5" y1="10.3" x2="19.5" y2="16.5" />
    </>
  ),

  // Pessoa (cabeça e ombros) ao lado de um quadro.
  professores: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M3 20C3 15.5 5.2 13.5 8 13.5C10.8 13.5 13 15.5 13 20" />
      <rect x="15" y="5" width="6" height="8" rx="1" />
      <line x1="18" y1="13" x2="18" y2="20" />
    </>
  ),

  // Chave: argola à esquerda, haste com dois dentes à direita.
  usuarios: (
    <>
      <circle cx="7.5" cy="12" r="4.5" />
      <line x1="12" y1="12" x2="21" y2="12" />
      <line x1="17" y1="12" x2="17" y2="15" />
      <line x1="20" y1="12" x2="20" y2="14.5" />
    </>
  ),

  // Prédio escolar: frontão triangular, fachada e porta central.
  cursos: (
    <>
      <path d="M3 9.5L12 4L21 9.5Z" />
      <rect x="5" y="9.5" width="14" height="11.5" />
      <path d="M10 21V16.5H14V21" />
    </>
  ),

  // Calendário com um intervalo marcado por barra horizontal (diferente de calendario, que tem pontos).
  periodos: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M8 3V6.5M16 3V6.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="15.5" x2="16" y2="15.5" />
    </>
  ),

  // Grupo: pessoa na frente e outra atrás, deslocada para a direita.
  turmas: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 20C3 15.5 5.5 13.5 9 13.5C12.5 13.5 15 15.5 15 20" />
      <circle cx="16.5" cy="7" r="2.5" />
      <path d="M16.5 13C19.5 13 21 15.5 21 19" />
    </>
  ),

  // Folha com duas linhas de texto e lápis na diagonal no canto inferior direito.
  matriculas: (
    <>
      <rect x="3" y="3.5" width="8.5" height="17" rx="1.5" />
      <line x1="6" y1="8.5" x2="9" y2="8.5" />
      <line x1="6" y1="12" x2="9" y2="12" />
      <polygon points="13 19 14.5 14.5 17.5 11.5 20.5 14.5 17.5 17.5" />
      <line x1="14.5" y1="14.5" x2="17.5" y2="17.5" />
    </>
  ),

  // Caderno fechado: lombada à esquerda e duas linhas curtas na capa.
  diario: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="12" y1="9" x2="16" y2="9" />
      <line x1="12" y1="13" x2="16" y2="13" />
    </>
  ),

  // Gráfico de três barras de alturas diferentes sobre uma linha de base.
  boletim: (
    <>
      <line x1="3" y1="20.5" x2="21" y2="20.5" />
      <line x1="7" y1="12" x2="7" y2="17.5" />
      <line x1="12" y1="7" x2="12" y2="17.5" />
      <line x1="17" y1="10" x2="17" y2="17.5" />
    </>
  ),

  // Documento com canto superior direito dobrado e três linhas de texto.
  historico: (
    <>
      <path d="M14 3H7A2 2 0 0 0 5 5V19A2 2 0 0 0 7 21H17A2 2 0 0 0 19 19V8Z" />
      <path d="M14 3V8H19" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
      <line x1="9" y1="18" x2="13" y2="18" />
    </>
  ),

  // Erlenmeyer: gargalo estreito, corpo triangular e linha de nível.
  pos: (
    <>
      <path d="M9.5 3.5H14.5V9L19.5 18.5Q20.5 20.5 18.5 20.5H5.5Q3.5 20.5 4.5 18.5L9.5 9Z" />
      <line x1="7.5" y1="15.5" x2="16.5" y2="15.5" />
    </>
  ),

  // Moeda com cifrão simplificado (S com traço vertical).
  financeiro: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5C14.5 8 13 7.5 12 7.5C10.5 7.5 9 8.5 9 9.5C9 11 10.5 11.5 12 12C13.5 12.5 15 13 15 14.5C15 15.5 13.5 16.5 12 16.5C10.5 16.5 9.5 16 9 14.5" />
      <line x1="12" y1="6" x2="12" y2="18" />
    </>
  ),

  // Livro aberto visto de frente: duas páginas que se encontram na lombada central.
  biblioteca: (
    <>
      <path d="M12 7C9.5 5.5 6.5 5 3.5 6V18C6.5 17 9.5 17.5 12 19Z" />
      <path d="M12 7C14.5 5.5 17.5 5 20.5 6V18C17.5 17 14.5 17.5 12 19Z" />
    </>
  ),

  // Relógio: círculo com ponteiro para cima e ponteiro para a direita.
  horarios: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 12" />
    </>
  ),

  // Calendário com dois anéis no topo, cabeçalho e quatro pontos de dias.
  calendario: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M8 3V6.5M16 3V6.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8.5 13.5h.01M15.5 13.5h.01M8.5 17.5h.01M15.5 17.5h.01" />
    </>
  ),

  // Megafone: cone que abre para a direita, com o cabo embaixo.
  comunicados: (
    <>
      <path d="M4 10H8L19 5V19L8 14H4Z" />
      <path d="M8 14L9.5 19.5H12L10.5 15" />
    </>
  ),

  // Pessoa dentro de um círculo: círculo externo, cabeça e ombros.
  perfil: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="9.5" r="3" />
      <path d="M6.5 18.5C7.5 15.5 9.5 14.5 12 14.5C14.5 14.5 16.5 15.5 17.5 18.5" />
    </>
  ),

  // Três linhas horizontais paralelas.
  menu: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </>
  ),

  // Três pontos preenchidos em linha horizontal.
  mais: (
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),

  // Porta (colchete aberto para a direita) com seta saindo para a direita.
  sair: (
    <>
      <polyline points="10 4.5 4.5 4.5 4.5 19.5 10 19.5" />
      <line x1="9" y1="12" x2="21" y2="12" />
      <polyline points="17 8 21 12 17 16" />
    </>
  ),

  // X: duas diagonais cruzadas.
  fechar: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
};

export function Icone({
  nome,
  tamanho = 22,
  className,
}: {
  nome: NomeIcone;
  tamanho?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {DESENHOS[nome]}
    </svg>
  );
}
