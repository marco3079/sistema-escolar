// Formatos devolvidos pela API do módulo cadastros (sem senhaHash).

export interface UsuarioDTO {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  cpf: string | null;
  telefone: string | null;
  criadoEm: string;
}

export interface AlunoDTO {
  id: number;
  usuarioId: number;
  ra: string;
  dataNascimento: string;
  endereco: string | null;
  responsavelNome: string | null;
  responsavelTelefone: string | null;
  responsavelEmail: string | null;
  usuario: {
    id: number;
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    ativo: boolean;
  };
}

export interface ProfessorDTO {
  id: number;
  usuarioId: number;
  registro: string;
  titulacao: string;
  area: string | null;
  usuario: {
    id: number;
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    ativo: boolean;
  };
}

export interface PerfilMeu extends UsuarioDTO {
  aluno: {
    id: number;
    ra: string;
    dataNascimento: string;
    endereco: string | null;
    responsavelNome: string | null;
    responsavelTelefone: string | null;
    responsavelEmail: string | null;
  } | null;
  professor: {
    id: number;
    registro: string;
    titulacao: string;
    area: string | null;
  } | null;
}

// Respostas de GET /alunos/:id/ficha e GET /professores/:id/ficha (docs/plano/i-g05-fichas-api.md).

export interface FichaAlunoDTO {
  aluno: {
    id: number;
    ra: string;
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    ativo: boolean;
    dataNascimento: string;
    idade: number;
    endereco: string | null;
    responsavelNome: string | null;
    responsavelTelefone: string | null;
    responsavelEmail: string | null;
    usuarioId: number;
    criadoEm: string;
  };
  indicadores: {
    disciplinasCursando: number;
    mediaGeral: number | null;
    frequenciaMedia: number | null;
    mensalidadesEmAberto: number;
    valorEmAberto: number;
    emprestimosAtivos: number;
  };
  matriculas: {
    id: number;
    status: string;
    serieAtual: number;
    dataMatricula: string;
    curso: { id: number; nome: string; nivel: string; regime: string };
    periodoIngresso: string;
  }[];
  disciplinas: {
    inscricaoId: number;
    disciplina: string;
    codigo: string;
    turma: string;
    periodo: string;
    professor: string;
    status: string;
    notaFinal: number | null;
    frequencia: number | null;
  }[];
  mensalidades: {
    id: number;
    competencia: string;
    vencimento: string;
    valorFinal: number;
    status: string;
  }[];
  emprestimos: {
    id: number;
    livro: string;
    retiradoEm: string;
    devolucaoPrevista: string;
    devolvidoEm: string | null;
    atrasado: boolean;
  }[];
  projeto: { id: number; titulo: string; status: string; orientador: string } | null;
}

export interface FichaProfessorDTO {
  professor: {
    id: number;
    registro: string;
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    ativo: boolean;
    titulacao: string;
    area: string | null;
    usuarioId: number;
    criadoEm: string;
  };
  indicadores: {
    turmasAtivas: number;
    alunos: number;
    orientacoes: number;
    frequenciaMedia: number | null;
    mediaDasTurmas: number | null;
    cargaSemanalHoras: number;
  };
  turmas: {
    id: number;
    codigo: string;
    disciplina: string;
    curso: string;
    periodo: string;
    periodoAtivo: boolean;
    grupo: string | null;
    sala: string | null;
    inscritos: number;
    vagas: number;
  }[];
  horarios: {
    diaSemana: number;
    horaInicio: string;
    horaFim: string;
    sala: string | null;
    turma: string;
    disciplina: string;
  }[];
  orientacoes: {
    id: number;
    titulo: string;
    status: string;
    aluno: string;
    curso: string;
    papel: 'Orientador' | 'Coorientador';
  }[];
  bancas: {
    id: number;
    tipo: string;
    data: string;
    resultado: string;
    papel: string;
    projeto: string;
  }[];
  emprestimos: {
    id: number;
    livro: string;
    retiradoEm: string;
    devolucaoPrevista: string;
    devolvidoEm: string | null;
    atrasado: boolean;
  }[];
}

export const TITULACOES: { valor: string; rotulo: string }[] = [
  { valor: 'GRADUADO', rotulo: 'Graduado' },
  { valor: 'ESPECIALISTA', rotulo: 'Especialista' },
  { valor: 'MESTRE', rotulo: 'Mestre' },
  { valor: 'DOUTOR', rotulo: 'Doutor' },
];

export const PERFIS: { valor: string; rotulo: string }[] = [
  { valor: 'ADMIN', rotulo: 'Administrador' },
  { valor: 'SECRETARIA', rotulo: 'Secretaria' },
  { valor: 'PROFESSOR', rotulo: 'Professor' },
  { valor: 'ALUNO', rotulo: 'Aluno' },
];

export function rotuloTitulacao(valor: string): string {
  return TITULACOES.find((t) => t.valor === valor)?.rotulo ?? valor;
}

export function rotuloPerfil(valor: string): string {
  return PERFIS.find((p) => p.valor === valor)?.rotulo ?? valor;
}

// Campo vazio vira null (opcional); senão devolve o texto sem espaços das pontas.
export function nulo(valor: string): string | null {
  const limpo = valor.trim();
  return limpo === '' ? null : limpo;
}

// Datas de nascimento: a API guarda meia-noite UTC, então usa-se o dia do ISO direto
// (evita deslocamento de um dia no fuso do Brasil).
export function dataParaInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function dataBr(iso: string | null): string {
  const dia = dataParaInput(iso);
  if (!dia) return '—';
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
}

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Monta a query string ignorando valores vazios: queryString({ busca: '', perfil: 'ADMIN' }) -> '?perfil=ADMIN'.
export function queryString(params: Record<string, string>): string {
  const partes = Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return partes.length ? `?${partes.join('&')}` : '';
}

// Log de atividades (docs/plano/segunda-leva.md): GET /logs, GET /logs/usuarios/:id/resumo.

export interface LogDTO {
  id: number;
  criadoEm: string;
  usuarioId: number | null;
  usuarioNome: string | null;
  perfil: string | null;
  tipo: string;
  modulo: string;
  descricao: string;
  metodo: string | null;
  caminho: string | null;
  status: number | null;
  duracaoMs: number | null;
  ip: string | null;
  navegador: string | null;
}

export interface ListaLogDTO {
  itens: LogDTO[];
  haMais: boolean;
}

export interface ResumoUsuarioLogDTO {
  ultimoLogin: string | null;
  ultimaAtividade: string | null;
  telaAtual: string | null;
  online: boolean;
  atividadesHoje: number;
  atividades7Dias: number;
  porTipo: { tipo: string; total: number }[];
}

// Importação por planilha (docs/plano/quinta-leva.md, Q4): GET /alunos/importar/modelo, POST /alunos/importar (e professores).

export interface ModeloImportacaoDTO {
  colunas: string[];
  exemplo: string[];
}

export interface ResultadoImportacaoDTO {
  total: number;
  validas: number;
  criadas: number;
  resultados: {
    linha: number;
    situacao: 'OK' | 'ERRO' | 'CRIADA';
    erros: string[];
    nome: string;
    email: string;
  }[];
}
