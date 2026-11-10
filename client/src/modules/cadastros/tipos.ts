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
