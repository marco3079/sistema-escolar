import type { ReactNode } from 'react';

export type NomeIcone =
  | 'inicio' | 'alunos' | 'professores' | 'usuarios' | 'cursos' | 'periodos' | 'turmas'
  | 'matriculas' | 'diario' | 'boletim' | 'historico' | 'pos' | 'financeiro' | 'biblioteca'
  | 'horarios' | 'calendario' | 'comunicados' | 'perfil' | 'menu' | 'mais' | 'sair' | 'fechar'
  | 'busca' | 'sino' | 'seta-direita' | 'seta-cima' | 'seta-baixo' | 'chevron-baixo'
  | 'relogio' | 'raio' | 'grafico' | 'engrenagem' | 'documento' | 'lapis';

export const NOMES_ICONES: NomeIcone[] = [
  'inicio', 'alunos', 'professores', 'usuarios', 'cursos', 'periodos', 'turmas',
  'matriculas', 'diario', 'boletim', 'historico', 'pos', 'financeiro', 'biblioteca',
  'horarios', 'calendario', 'comunicados', 'perfil', 'menu', 'mais', 'sair', 'fechar',
  'busca', 'sino', 'seta-direita', 'seta-cima', 'seta-baixo', 'chevron-baixo',
  'relogio', 'raio', 'grafico', 'engrenagem', 'documento', 'lapis',
];

// Desenhos sólidos em grade 24 x 24 (área útil 2.5 a 21.5). Preenchidos com currentColor.
// Recortes internos: subcaminhos dentro do mesmo <path> com fillRule="evenodd".
// Ícones de linha pura (menu, fechar, busca, setas, chevron) usam traço no próprio elemento.
const DESENHOS: Record<NomeIcone, ReactNode> = {
  // Casa sólida com a porta recortada na base.
  inicio: <path d="M12 3L21.5 11H19V21H14V15.5H10V21H5V11H2.5Z" />,

  // Pessoa com capelo pequeno sobre a cabeça e borla do lado direito.
  alunos: (
    <>
      <circle cx="12" cy="12.5" r="3" />
      <path d="M5 21.5C5 18.2 8 16.4 12 16.4C16 16.4 19 18.2 19 21.5Z" />
      <path d="M12 2.8L18.2 5.6L12 8.4L5.8 5.6ZM17.6 6.2L18.6 5.8V10.2H17.6Z" />
    </>
  ),

  // Pessoa ao lado de um quadro sólido (moldura recortada) sobre um cavalete.
  professores: (
    <>
      <circle cx="8" cy="8.5" r="3.5" />
      <path d="M2.5 21.5C2.5 16.6 4.8 13.6 8 13.6C11.2 13.6 13.5 16.6 13.5 21.5Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M15 4H21.5V12H15ZM16.6 5.6V10.4H19.9V5.6Z" />
      <path d="M17.2 12H18.8V20.5H20.5V21.5H15.5V20.5H17.2Z" />
    </>
  ),

  // Chave: argola recortada à esquerda, haste com dois dentes à direita.
  usuarios: (
    <>
      <path fillRule="evenodd" clipRule="evenodd" d="M2.7 12A4.8 4.8 0 1 0 12.3 12A4.8 4.8 0 1 0 2.7 12ZM5.3 12A2.2 2.2 0 1 0 9.7 12A2.2 2.2 0 1 0 5.3 12Z" />
      <path d="M11.5 10.6H21.5V15.8H19.6V13.4H18.7V15.8H16.8V13.4H11.5Z" />
    </>
  ),

  // Prédio escolar: frontão sólido com janela redonda recortada e fachada com porta.
  cursos: (
    <>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 3.5L21.5 9.5H2.5ZM12 6.3A1.2 1.2 0 1 0 12 8.7A1.2 1.2 0 1 0 12 6.3Z" />
      <path d="M4.5 9.5H19.5V21.5H14V16H10V21.5H4.5Z" />
    </>
  ),

  // Calendário sólido com argolas no topo e um intervalo marcado por barra recortada.
  periodos: (
    <>
      <path fillRule="evenodd" clipRule="evenodd" d="M5.5 4.5H18.5Q21 4.5 21 7V19Q21 21.5 18.5 21.5H5.5Q3 21.5 3 19V7Q3 4.5 5.5 4.5ZM7 12.5H17V14.5H7Z" />
      <path d="M7.5 2.5H9.5V6.5H7.5ZM14.5 2.5H16.5V6.5H14.5Z" />
    </>
  ),

  // Grupo: pessoa na frente e outra menor atrás, à direita.
  turmas: (
    <>
      <circle cx="8.5" cy="8" r="3.5" />
      <path d="M2.5 21.5C2.5 16.6 5 13.2 8.5 13.2C12 13.2 14.5 16.6 14.5 21.5Z" />
      <circle cx="16.8" cy="6.8" r="2.9" />
      <path d="M15.6 21.5C15.6 16.2 17.2 11.2 19 11.2C20.8 11.2 21.5 16 21.5 21.5Z" />
    </>
  ),

  // Folha sólida com duas linhas recortadas e um lápis na diagonal no canto inferior direito.
  matriculas: (
    <>
      <path fillRule="evenodd" clipRule="evenodd" d="M3 2.5H11.5V21.5H3ZM5.8 7.5H10V9.1H5.8ZM5.8 11H10V12.6H5.8Z" />
      <path d="M12.5 21.5L15.82 20.58L21.4 15L19 12.6L13.42 18.18Z" />
    </>
  ),

  // Caderno sólido com lombada separada por fenda vertical e duas linhas recortadas.
  diario: (
    <path fillRule="evenodd" clipRule="evenodd" d="M7.5 2.5H18Q20.5 2.5 20.5 5V19Q20.5 21.5 18 21.5H7.5Q5 21.5 5 19V5Q5 2.5 7.5 2.5ZM8.2 2.5H9.2V21.5H8.2ZM11.5 8H16.5V9.6H11.5ZM11.5 11.8H16.5V13.4H11.5Z" />
  ),

  // Três barras sólidas de alturas diferentes.
  boletim: <path d="M4 12H7.6V21.5H4ZM10.2 7H13.8V21.5H10.2ZM16.4 10H20V21.5H16.4Z" />,

  // Documento com canto superior direito dobrado e três linhas recortadas.
  historico: (
    <path fillRule="evenodd" clipRule="evenodd" d="M6.5 2.5H13.8L19.5 8.2V19.5Q19.5 21.5 17.5 21.5H6.5Q4.5 21.5 4.5 19.5V4.5Q4.5 2.5 6.5 2.5ZM13.8 2.5V8.2H19.5ZM8.5 12H15.5V13.6H8.5ZM8.5 15.4H15.5V17H8.5ZM8.5 18.8H12.5V20.4H8.5Z" />
  ),

  // Erlenmeyer sólido com gargalo, lábio e faixa de nível recortada.
  pos: (
    <path fillRule="evenodd" clipRule="evenodd" d="M8.5 2.5H15.5V4H14.5V9.2L19.8 18.6Q21 21 18.5 21H5.5Q3 21 4.2 18.6L9.5 9.2V4H8.5ZM7.8 14.2H16.2V15.5H7.8Z" />
  ),

  // Moeda: anel sólido com um cifrão sólido no centro.
  financeiro: (
    <>
      <path fillRule="evenodd" clipRule="evenodd" d="M3 12A9 9 0 1 0 21 12A9 9 0 1 0 3 12ZM4.8 12A7.2 7.2 0 1 0 19.2 12A7.2 7.2 0 1 0 4.8 12Z" />
      <path d="M9.5 7.6H14.5V9.3H9.5ZM9.5 9.3H11.2V12.2H9.5ZM9.5 12.2H14.5V13.9H9.5ZM12.8 13.9H14.5V14.7H12.8ZM9.5 14.7H14.5V16.4H9.5ZM11.6 5.4H12.4V7.6H11.6ZM11.6 16.4H12.4V18.6H11.6Z" />
    </>
  ),

  // Livro aberto sólido, com a lombada central recortada entre as duas páginas.
  biblioteca: (
    <path d="M11.2 6.6C8.6 5.2 5.6 4.8 2.5 5.6V18.4C5.6 17.6 8.6 18 11.2 19.4ZM12.8 6.6C15.4 5.2 18.4 4.8 21.5 5.6V18.4C18.4 17.6 15.4 18 12.8 19.4Z" />
  ),

  // Relógio em anel sólido com ponteiros sólidos (um para cima, um para a direita).
  horarios: (
    <>
      <path fillRule="evenodd" clipRule="evenodd" d="M3 12A9 9 0 1 0 21 12A9 9 0 1 0 3 12ZM4.8 12A7.2 7.2 0 1 0 19.2 12A7.2 7.2 0 1 0 4.8 12Z" />
      <path d="M11 6H13V11H16.5V13H11Z" />
    </>
  ),

  // Calendário sólido com cabeçalho separado por fenda, quatro dias recortados e argolas.
  calendario: (
    <>
      <path fillRule="evenodd" clipRule="evenodd" d="M5.5 4.5H18.5Q21 4.5 21 7V19Q21 21.5 18.5 21.5H5.5Q3 21.5 3 19V7Q3 4.5 5.5 4.5ZM3 9.2H21V10.4H3ZM7 13.1A1 1 0 1 0 9 13.1A1 1 0 1 0 7 13.1ZM14.6 13.1A1 1 0 1 0 16.6 13.1A1 1 0 1 0 14.6 13.1ZM7 17.1A1 1 0 1 0 9 17.1A1 1 0 1 0 7 17.1ZM14.6 17.1A1 1 0 1 0 16.6 17.1A1 1 0 1 0 14.6 17.1Z" />
      <path d="M7.5 2.5H9.5V6.5H7.5ZM14.5 2.5H16.5V6.5H14.5Z" />
    </>
  ),

  // Megafone sólido: cone que abre para a direita, com o cabo embaixo.
  comunicados: (
    <>
      <path d="M3.5 9.5H8L19.5 4.5V19.5L8 14.5H3.5Z" />
      <path d="M7.5 14.5H10L11.4 20.5H9.1Z" />
    </>
  ),

  // Pessoa recortada dentro de um disco sólido.
  perfil: (
    <path fillRule="evenodd" clipRule="evenodd" d="M2.5 12A9.5 9.5 0 1 0 21.5 12A9.5 9.5 0 1 0 2.5 12ZM9 9.2A3 3 0 1 0 15 9.2A3 3 0 1 0 9 9.2ZM6.2 18.2C6.8 15.4 9 14.2 12 14.2C15 14.2 17.2 15.4 17.8 18.2Z" />
  ),

  // Três linhas horizontais (traço puro).
  menu: <path d="M4 6H20M4 12H20M4 18H20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />,

  // Três pontos sólidos em linha horizontal.
  mais: (
    <>
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="19" cy="12" r="2.2" />
    </>
  ),

  // Colchete de porta sólido à esquerda com seta sólida saindo para a direita.
  sair: (
    <>
      <path d="M2.5 3.5H10V6.5H5.8V17.5H10V20.5H2.5Z" />
      <path d="M9 10.6H16.5V7.5L21.5 12L16.5 16.5V13.4H9Z" />
    </>
  ),

  // X: duas diagonais cruzadas (traço puro).
  fechar: <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />,

  // Lupa: aro e cabo na diagonal (traço puro).
  busca: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth={2.2} />
      <path d="M15.5 15.5L20.5 20.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </>
  ),

  // Sino sólido com o badalo embaixo.
  sino: (
    <>
      <path d="M12 2.8C8.4 2.8 6.4 5.5 6.4 9V13.6L4.4 16.4V17.6H19.6V16.4L17.6 13.6V9C17.6 5.5 15.6 2.8 12 2.8Z" />
      <path d="M10.2 18.6H13.8C13.8 19.6 13 20.5 12 20.5C11 20.5 10.2 19.6 10.2 18.6Z" />
    </>
  ),

  // Seta para a direita (traço puro com ponta).
  'seta-direita': <path d="M4.5 12H19.5M13.5 6L19.5 12L13.5 18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />,

  // Seta para cima (traço puro com ponta).
  'seta-cima': <path d="M12 19.5V4.5M6 10.5L12 4.5L18 10.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />,

  // Seta para baixo (traço puro com ponta).
  'seta-baixo': <path d="M12 4.5V19.5M6 13.5L12 19.5L18 13.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />,

  // "V" aberto para baixo (traço puro).
  'chevron-baixo': <path d="M6 9.5L12 15.5L18 9.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />,

  // Cronômetro sólido com coroa no topo e ponteiros recortados.
  relogio: (
    <>
      <path fillRule="evenodd" clipRule="evenodd" d="M3 12A9 9 0 1 0 21 12A9 9 0 1 0 3 12ZM11 6.5H13V11H16.5V13H11Z" />
      <path d="M10.5 2.5H13.5V4.2H10.5Z" />
    </>
  ),

  // Raio sólido em zigue-zague.
  raio: <path d="M13.5 2.5L4.5 13.5H11L9.5 21.5L19.5 9.8H13Z" />,

  // Três barras sólidas crescentes com uma ponta de seta sólida no canto superior direito.
  grafico: (
    <path d="M3.5 14H8.2V21.5H3.5ZM9.9 11H14.6V21.5H9.9ZM16.3 8H21V21.5H16.3ZM14.5 2.5H21.5V9.5Z" />
  ),

  // Engrenagem de oito dentes sólidos com o furo central recortado.
  engrenagem: (
    <path fillRule="evenodd" clipRule="evenodd" d="M10.31 5.21L10.51 2.62L13.49 2.62L13.69 5.21L15.61 6L17.58 4.31L19.69 6.42L18 8.4L18.79 10.31L21.38 10.51L21.38 13.49L18.79 13.69L18 15.61L19.69 17.58L17.58 19.69L15.61 18L13.69 18.79L13.49 21.38L10.51 21.38L10.31 18.79L8.4 18L6.42 19.69L4.31 17.58L6 15.61L5.21 13.69L2.62 13.49L2.62 10.51L5.21 10.31L6 8.4L4.31 6.42L6.42 4.31L8.4 6ZM9 12A3 3 0 1 0 15 12A3 3 0 1 0 9 12Z" />
  ),

  // Folha sólida com canto inferior direito dobrado e duas linhas recortadas.
  documento: (
    <path fillRule="evenodd" clipRule="evenodd" d="M4.5 2.5H19.5V15.5L14.5 21.5H4.5ZM14.5 15.5H19.5L14.5 21.5ZM8 7H16V8.8H8ZM8 11.2H16V13H8Z" />
  ),

  // Lápis sólido na diagonal, ponta para baixo à esquerda, com a virola recortada.
  lapis: (
    <path fillRule="evenodd" clipRule="evenodd" d="M3.5 20.5L8.24 18.88L21.06 6.06L17.94 2.94L5.12 15.76ZM14.21 6.67L17.33 9.79L17.96 9.16L14.84 6.04Z" />
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
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {DESENHOS[nome]}
    </svg>
  );
}
