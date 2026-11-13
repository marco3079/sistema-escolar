// Dados de demonstração fictícios (Instituto Horizonte); carregados por seed.ts quando SEED_DEMO=true e o banco está vazio.

import { PrismaClient } from '@prisma/client';
import type {
  Aluno,
  Curso,
  Disciplina,
  Inscricao,
  Livro,
  Matricula,
  PeriodoLetivo,
  Prisma,
  Professor,
  StatusInscricao,
  StatusMensalidade,
  TipoEvento,
  Turma,
  Usuario,
  Avaliacao,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const SENHA_HASH = bcrypt.hashSync('demo1234', 10);
const NOTA_MAXIMA = 10;

// ---------- Auxiliares ----------

const d = (ano: number, mes: number, dia: number, hora = 0, minuto = 0): Date =>
  new Date(ano, mes - 1, dia, hora, minuto);

const addDias = (base: Date, dias: number): Date => new Date(base.getTime() + dias * 86400000);

const arred = (n: number): number => Math.round(n * 10) / 10;

let contadorFone = 0;
const proximoFone = (): string => {
  contadorFone += 1;
  return `(11) 90000-00${String(contadorFone).padStart(2, '0')}`;
};

// Média ponderada na escala 0 a 10 (regra 5.5 do contrato).
const media = (itens: { valor: number; peso: number }[]): number => {
  const somaPesos = itens.reduce((soma, i) => soma + i.peso, 0);
  if (somaPesos === 0) return 0;
  return itens.reduce((soma, i) => soma + (i.valor / NOTA_MAXIMA) * 10 * i.peso, 0) / somaPesos;
};

// ---------- Especificações ----------

type ChaveProf = 'ana' | 'bruno' | 'carla' | 'diego';

interface DisciplinaSpec {
  curso: string;
  codigo: string;
  nome: string;
  ch: number;
  periodo: number;
  prof: ChaveProf;
  pre?: string[];
}

const CURSOS: Prisma.CursoCreateInput[] = [
  { codigo: 'EF1', nome: 'Ensino Fundamental I', nivel: 'FUNDAMENTAL_1', regime: 'SERIADO', duracaoPeriodos: 5, cargaHorariaTotal: 4000, mensalidade: 850 },
  { codigo: 'EF2', nome: 'Ensino Fundamental II', nivel: 'FUNDAMENTAL_2', regime: 'SERIADO', duracaoPeriodos: 4, cargaHorariaTotal: 3200, mensalidade: 950 },
  { codigo: 'EM', nome: 'Ensino Médio', nivel: 'MEDIO', regime: 'SERIADO', duracaoPeriodos: 3, cargaHorariaTotal: 3000, mensalidade: 1100 },
  { codigo: 'TINF', nome: 'Técnico em Informática', nivel: 'TECNICO', regime: 'SERIADO', duracaoPeriodos: 2, cargaHorariaTotal: 1200, mensalidade: 600 },
  { codigo: 'BCC', nome: 'Bacharelado em Ciência da Computação', nivel: 'GRADUACAO', regime: 'CREDITOS', duracaoPeriodos: 8, cargaHorariaTotal: 3200, mensalidade: 1400 },
  { codigo: 'ESPDS', nome: 'Especialização em Ciência de Dados', nivel: 'ESPECIALIZACAO', regime: 'CREDITOS', duracaoPeriodos: 3, cargaHorariaTotal: 360, mensalidade: 900 },
  { codigo: 'MCC', nome: 'Mestrado em Computação', nivel: 'MESTRADO', regime: 'CREDITOS', duracaoPeriodos: 4, cargaHorariaTotal: 720, mensalidade: 0 },
  { codigo: 'DCC', nome: 'Doutorado em Computação', nivel: 'DOUTORADO', regime: 'CREDITOS', duracaoPeriodos: 8, cargaHorariaTotal: 1440, mensalidade: 0 },
];

// Códigos de disciplina únicos no banco (prefixados pelo curso).
const DISCIPLINAS: DisciplinaSpec[] = [
  { curso: 'EF1', codigo: 'EF1-LP', nome: 'Língua Portuguesa', ch: 160, periodo: 3, prof: 'carla' },
  { curso: 'EF1', codigo: 'EF1-MAT', nome: 'Matemática', ch: 160, periodo: 3, prof: 'bruno' },
  { curso: 'EF1', codigo: 'EF1-CIE', nome: 'Ciências', ch: 160, periodo: 3, prof: 'diego' },
  { curso: 'EF1', codigo: 'EF1-HIS', nome: 'História', ch: 160, periodo: 3, prof: 'carla' },
  { curso: 'EF1', codigo: 'EF1-GEO', nome: 'Geografia', ch: 160, periodo: 3, prof: 'carla' },

  { curso: 'EF2', codigo: 'EF2-LP', nome: 'Língua Portuguesa', ch: 120, periodo: 1, prof: 'carla' },
  { curso: 'EF2', codigo: 'EF2-MAT', nome: 'Matemática', ch: 120, periodo: 1, prof: 'bruno' },
  { curso: 'EF2', codigo: 'EF2-CIE', nome: 'Ciências', ch: 120, periodo: 1, prof: 'diego' },
  { curso: 'EF2', codigo: 'EF2-HIS', nome: 'História', ch: 120, periodo: 1, prof: 'carla' },
  { curso: 'EF2', codigo: 'EF2-GEO', nome: 'Geografia', ch: 120, periodo: 1, prof: 'carla' },
  { curso: 'EF2', codigo: 'EF2-ING', nome: 'Inglês', ch: 120, periodo: 1, prof: 'carla' },

  { curso: 'EM', codigo: 'EM-LP', nome: 'Língua Portuguesa', ch: 120, periodo: 1, prof: 'carla' },
  { curso: 'EM', codigo: 'EM-MAT', nome: 'Matemática', ch: 120, periodo: 1, prof: 'bruno' },
  { curso: 'EM', codigo: 'EM-FIS', nome: 'Física', ch: 120, periodo: 1, prof: 'bruno' },
  { curso: 'EM', codigo: 'EM-QUI', nome: 'Química', ch: 120, periodo: 1, prof: 'diego' },
  { curso: 'EM', codigo: 'EM-BIO', nome: 'Biologia', ch: 120, periodo: 1, prof: 'diego' },
  { curso: 'EM', codigo: 'EM-HIS', nome: 'História', ch: 120, periodo: 1, prof: 'carla' },

  { curso: 'TINF', codigo: 'TINF-LOG', nome: 'Lógica de Programação', ch: 120, periodo: 1, prof: 'ana' },
  { curso: 'TINF', codigo: 'TINF-RED', nome: 'Redes de Computadores', ch: 120, periodo: 1, prof: 'ana' },
  { curso: 'TINF', codigo: 'TINF-BD', nome: 'Banco de Dados', ch: 120, periodo: 1, prof: 'ana' },

  { curso: 'BCC', codigo: 'BCC-ALG1', nome: 'Algoritmos I', ch: 60, periodo: 1, prof: 'ana' },
  { curso: 'BCC', codigo: 'BCC-CAL1', nome: 'Cálculo I', ch: 60, periodo: 1, prof: 'bruno' },
  { curso: 'BCC', codigo: 'BCC-ICOMP', nome: 'Introdução à Computação', ch: 30, periodo: 1, prof: 'ana' },
  { curso: 'BCC', codigo: 'BCC-ALG2', nome: 'Algoritmos II', ch: 60, periodo: 2, prof: 'ana', pre: ['BCC-ALG1'] },
  { curso: 'BCC', codigo: 'BCC-CAL2', nome: 'Cálculo II', ch: 60, periodo: 2, prof: 'bruno', pre: ['BCC-CAL1'] },
  { curso: 'BCC', codigo: 'BCC-ED', nome: 'Estruturas de Dados', ch: 60, periodo: 2, prof: 'ana', pre: ['BCC-ALG1'] },
  { curso: 'BCC', codigo: 'BCC-BD1', nome: 'Banco de Dados I', ch: 60, periodo: 3, prof: 'ana', pre: ['BCC-ED'] },

  { curso: 'ESPDS', codigo: 'ESPDS-EST', nome: 'Estatística para Dados', ch: 45, periodo: 1, prof: 'bruno' },
  { curso: 'ESPDS', codigo: 'ESPDS-AM', nome: 'Aprendizado de Máquina', ch: 60, periodo: 1, prof: 'ana' },
  { curso: 'ESPDS', codigo: 'ESPDS-VIS', nome: 'Visualização de Dados', ch: 45, periodo: 1, prof: 'ana' },

  { curso: 'MCC', codigo: 'MCC-MP', nome: 'Metodologia de Pesquisa', ch: 60, periodo: 1, prof: 'diego' },
  { curso: 'MCC', codigo: 'MCC-TIA', nome: 'Tópicos em Inteligência Artificial', ch: 60, periodo: 1, prof: 'ana' },
  { curso: 'MCC', codigo: 'MCC-SEM', nome: 'Seminários de Mestrado', ch: 30, periodo: 1, prof: 'bruno' },

  { curso: 'DCC', codigo: 'DCC-SEM', nome: 'Seminários Avançados', ch: 60, periodo: 1, prof: 'diego' },
  { curso: 'DCC', codigo: 'DCC-SSD', nome: 'Tópicos Especiais em Sistemas Distribuídos', ch: 60, periodo: 1, prof: 'ana' },
  { curso: 'DCC', codigo: 'DCC-EST', nome: 'Estágio de Docência', ch: 30, periodo: 1, prof: 'bruno' },
];

// Grupo de cada curso seriado no período 2026.
const GRUPO_SERIADO: Record<string, string> = { EF1: '3A', EF2: '6A', EM: '1A', TINF: 'T1' };

interface HorarioSpec {
  periodo: string;
  turma: string; // código completo da turma
  dia: number; // 1 = segunda ... 7 = domingo
  inicio: string;
  fim: string;
  sala: string;
}

const HORARIOS: HorarioSpec[] = [
  // Manhã, turmas do grupo 6A (período 2026)
  { periodo: '2026', turma: 'EF2-LP-6A', dia: 1, inicio: '07:00', fim: '07:50', sala: 'Sala 101' },
  { periodo: '2026', turma: 'EF2-MAT-6A', dia: 1, inicio: '08:00', fim: '08:50', sala: 'Sala 101' },
  { periodo: '2026', turma: 'EF2-CIE-6A', dia: 2, inicio: '07:00', fim: '07:50', sala: 'Sala 102' },
  { periodo: '2026', turma: 'EF2-HIS-6A', dia: 2, inicio: '08:00', fim: '08:50', sala: 'Sala 102' },
  { periodo: '2026', turma: 'EF2-GEO-6A', dia: 3, inicio: '07:00', fim: '07:50', sala: 'Sala 101' },
  { periodo: '2026', turma: 'EF2-ING-6A', dia: 3, inicio: '08:00', fim: '08:50', sala: 'Sala 101' },

  // Noite, turmas do BCC (período 2026.2)
  { periodo: '2026.2', turma: 'BCC-ALG1-A', dia: 1, inicio: '19:00', fim: '20:00', sala: 'Lab 1' },
  { periodo: '2026.2', turma: 'BCC-ED-A', dia: 2, inicio: '19:00', fim: '20:00', sala: 'Lab 1' },
  { periodo: '2026.2', turma: 'BCC-ALG2-A', dia: 3, inicio: '19:00', fim: '20:00', sala: 'Lab 1' },
  { periodo: '2026.2', turma: 'BCC-CAL1-A', dia: 1, inicio: '20:00', fim: '21:00', sala: 'Sala 201' },
  { periodo: '2026.2', turma: 'BCC-CAL2-A', dia: 2, inicio: '20:00', fim: '21:00', sala: 'Sala 201' },
];

interface AlunoSpec {
  ra: string;
  nome: string;
  email: string;
  nascimento: Date;
  endereco: string;
  curso: string;
  ingresso: string;
  serie: number;
  grupo?: string;
  menor: boolean;
}

const ALUNOS: AlunoSpec[] = [
  { ra: '202600001', nome: 'Lucas Pereira', email: 'aluno.lucas@escola.demo', nascimento: d(2015, 3, 10), endereco: 'Rua das Acácias, 120 - Centro', curso: 'EF2', ingresso: '2026', serie: 1, grupo: '6A', menor: true },
  { ra: '202600002', nome: 'Sofia Almeida', email: 'aluna.sofia@escola.demo', nascimento: d(2018, 5, 20), endereco: 'Rua das Palmeiras, 45 - Jardim Alvorada', curso: 'EF1', ingresso: '2026', serie: 3, grupo: '3A', menor: true },
  { ra: '202600003', nome: 'Pedro Nogueira', email: 'aluno.pedro@escola.demo', nascimento: d(2014, 7, 2), endereco: 'Avenida Exemplo, 800 - Vila Nova', curso: 'EF2', ingresso: '2026', serie: 1, grupo: '6A', menor: true },
  { ra: '202600004', nome: 'Helena Castro', email: 'aluna.helena@escola.demo', nascimento: d(2010, 9, 15), endereco: 'Rua do Parque, 300 - Centro', curso: 'EM', ingresso: '2026', serie: 1, grupo: '1A', menor: true },
  { ra: '202600005', nome: 'Tiago Barros', email: 'aluno.tiago@escola.demo', nascimento: d(2007, 2, 11), endereco: 'Rua Azul, 58 - Bairro Novo', curso: 'TINF', ingresso: '2026', serie: 1, grupo: 'T1', menor: false },
  { ra: '202600006', nome: 'Marina Costa', email: 'aluna.marina@escola.demo', nascimento: d(2005, 4, 18), endereco: 'Rua Verde, 99 - Centro', curso: 'BCC', ingresso: '2026.1', serie: 1, menor: false },
  { ra: '202600007', nome: 'João Vieira', email: 'aluno.joao@escola.demo', nascimento: d(2004, 8, 30), endereco: 'Rua Clara, 210 - Vila Nova', curso: 'BCC', ingresso: '2026.1', serie: 1, menor: false },
  { ra: '202600008', nome: 'Beatriz Lima', email: 'aluna.beatriz@escola.demo', nascimento: d(1998, 11, 5), endereco: 'Alameda Central, 17 - Centro', curso: 'ESPDS', ingresso: '2026.2', serie: 1, menor: false },
  { ra: '202600009', nome: 'Camila Duarte', email: 'aluna.camila@escola.demo', nascimento: d(1996, 6, 22), endereco: 'Rua Nova, 36 - Jardim Europa', curso: 'MCC', ingresso: '2026.2', serie: 1, menor: false },
  { ra: '202600010', nome: 'Rafael Monteiro', email: 'aluno.rafael@escola.demo', nascimento: d(1990, 1, 14), endereco: 'Travessa Sul, 5 - Bairro Alto', curso: 'DCC', ingresso: '2026.2', serie: 1, menor: false },
];

interface InscricaoSpec {
  ra: string;
  periodo: string;
  turma: string;
  status: StatusInscricao;
  nota?: number;
  freq?: number;
}

const INSCRICOES_EXPLICITAS: InscricaoSpec[] = [
  // Marina (BCC) e João (BCC): 2026.1
  { ra: '202600006', periodo: '2026.1', turma: 'BCC-ALG1-A', status: 'APROVADO', nota: 8.5, freq: 92 },
  { ra: '202600006', periodo: '2026.1', turma: 'BCC-CAL1-A', status: 'APROVADO', nota: 7.0, freq: 85 },
  { ra: '202600006', periodo: '2026.1', turma: 'BCC-ICOMP-A', status: 'APROVADO', nota: 9.0, freq: 100 },
  { ra: '202600007', periodo: '2026.1', turma: 'BCC-ALG1-A', status: 'APROVADO', nota: 6.5, freq: 80 },
  { ra: '202600007', periodo: '2026.1', turma: 'BCC-ICOMP-A', status: 'APROVADO', nota: 7.5, freq: 90 },
  { ra: '202600007', periodo: '2026.1', turma: 'BCC-CAL1-A', status: 'REPROVADO_NOTA', nota: 4.0, freq: 78 },

  // 2026.2
  { ra: '202600006', periodo: '2026.2', turma: 'BCC-ALG2-A', status: 'CURSANDO' },
  { ra: '202600006', periodo: '2026.2', turma: 'BCC-CAL2-A', status: 'CURSANDO' },
  { ra: '202600006', periodo: '2026.2', turma: 'BCC-ED-A', status: 'CURSANDO' },
  { ra: '202600007', periodo: '2026.2', turma: 'BCC-ALG2-A', status: 'CURSANDO' },
  { ra: '202600007', periodo: '2026.2', turma: 'BCC-CAL1-A', status: 'CURSANDO' },
  { ra: '202600008', periodo: '2026.2', turma: 'ESPDS-EST-A', status: 'CURSANDO' },
  { ra: '202600008', periodo: '2026.2', turma: 'ESPDS-AM-A', status: 'CURSANDO' },
  { ra: '202600008', periodo: '2026.2', turma: 'ESPDS-VIS-A', status: 'CURSANDO' },
  { ra: '202600009', periodo: '2026.2', turma: 'MCC-MP-A', status: 'CURSANDO' },
  { ra: '202600009', periodo: '2026.2', turma: 'MCC-TIA-A', status: 'CURSANDO' },
  { ra: '202600009', periodo: '2026.2', turma: 'MCC-SEM-A', status: 'CURSANDO' },
  { ra: '202600010', periodo: '2026.2', turma: 'DCC-SEM-A', status: 'CURSANDO' },
  { ra: '202600010', periodo: '2026.2', turma: 'DCC-SSD-A', status: 'CURSANDO' },
  { ra: '202600010', periodo: '2026.2', turma: 'DCC-EST-A', status: 'CURSANDO' },
];

// Turmas com avaliações, notas e aulas lançadas.
interface AlunoNotas {
  ra: string;
  notas: [number, number]; // Prova 1, Trabalho
  presencas: boolean[]; // uma por aula
}

interface TurmaLancamento {
  periodo: string;
  codigo: string;
  datas: [Date, Date, Date]; // Prova 1, Trabalho, Prova 2
  datasAulas: Date[];
  alunos: AlunoNotas[];
}

const CONTEUDOS_AULAS = [
  'Apresentação do conteúdo',
  'Exercícios em sala',
  'Revisão para a avaliação',
  'Atividade prática',
];

const LANCAMENTOS: TurmaLancamento[] = [
  ...['EF2-LP', 'EF2-MAT', 'EF2-CIE', 'EF2-HIS', 'EF2-GEO', 'EF2-ING'].map((base) => ({
    periodo: '2026',
    codigo: `${base}-6A`,
    datas: [d(2026, 4, 14), d(2026, 5, 12), d(2026, 6, 16)] as [Date, Date, Date],
    datasAulas: [d(2026, 3, 3), d(2026, 3, 10), d(2026, 3, 17), d(2026, 3, 24)],
    alunos: [
      { ra: '202600001', notas: [7.5, 8] as [number, number], presencas: [true, false, true, true] },
      { ra: '202600003', notas: [6, 9] as [number, number], presencas: [true, true, false, true] },
    ],
  })),
  {
    periodo: '2026.2',
    codigo: 'BCC-ALG2-A',
    datas: [d(2026, 9, 22), d(2026, 10, 20), d(2026, 11, 24)],
    datasAulas: [d(2026, 8, 11), d(2026, 8, 18), d(2026, 8, 25), d(2026, 9, 1)],
    alunos: [
      { ra: '202600006', notas: [9.5, 9], presencas: [true, true, true, true] },
      { ra: '202600007', notas: [6, 7.5], presencas: [true, false, true, true] },
    ],
  },
];

// ---------- Execução ----------

export async function carregarDemonstracao(prisma: PrismaClient): Promise<void> {
  // Usuários administrativos
  const admin: Usuario = await prisma.usuario.create({
    data: { nome: 'Administrador Demo', email: 'admin@escola.demo', senhaHash: SENHA_HASH, perfil: 'ADMIN', telefone: proximoFone() },
  });
  const secretaria: Usuario = await prisma.usuario.create({
    data: { nome: 'Secretaria Demo', email: 'secretaria@escola.demo', senhaHash: SENHA_HASH, perfil: 'SECRETARIA', telefone: proximoFone() },
  });
  await prisma.usuario.create({
    data: { nome: 'Suporte de TI Demo', email: 'ti@escola.demo', senhaHash: SENHA_HASH, perfil: 'TI' },
  });

  // Professores
  const profs: Record<ChaveProf, Professor> = {
    ana: await prisma.professor.create({
      data: { registro: 'P0001', titulacao: 'DOUTOR', area: 'Computação', usuario: { create: { nome: 'Ana Ribeiro', email: 'prof.ana@escola.demo', senhaHash: SENHA_HASH, perfil: 'PROFESSOR', telefone: proximoFone() } } },
    }),
    bruno: await prisma.professor.create({
      data: { registro: 'P0002', titulacao: 'MESTRE', area: 'Matemática', usuario: { create: { nome: 'Bruno Tavares', email: 'prof.bruno@escola.demo', senhaHash: SENHA_HASH, perfil: 'PROFESSOR', telefone: proximoFone() } } },
    }),
    carla: await prisma.professor.create({
      data: { registro: 'P0003', titulacao: 'ESPECIALISTA', area: 'Língua Portuguesa', usuario: { create: { nome: 'Carla Mendes', email: 'prof.carla@escola.demo', senhaHash: SENHA_HASH, perfil: 'PROFESSOR', telefone: proximoFone() } } },
    }),
    diego: await prisma.professor.create({
      data: { registro: 'P0004', titulacao: 'DOUTOR', area: 'Ciências', usuario: { create: { nome: 'Diego Farias', email: 'prof.diego@escola.demo', senhaHash: SENHA_HASH, perfil: 'PROFESSOR', telefone: proximoFone() } } },
    }),
  };

  // Períodos letivos
  const periodos: Record<string, PeriodoLetivo> = {};
  periodos['2025'] = await prisma.periodoLetivo.create({
    data: { nome: '2025', ano: 2025, tipo: 'ANUAL', inicio: d(2025, 2, 3), fim: d(2025, 12, 12), ativo: false },
  });
  periodos['2026'] = await prisma.periodoLetivo.create({
    data: { nome: '2026', ano: 2026, tipo: 'ANUAL', inicio: d(2026, 2, 2), fim: d(2026, 12, 11), ativo: true },
  });
  periodos['2026.1'] = await prisma.periodoLetivo.create({
    data: { nome: '2026.1', ano: 2026, tipo: 'SEMESTRAL', inicio: d(2026, 2, 2), fim: d(2026, 6, 30), ativo: false },
  });
  periodos['2026.2'] = await prisma.periodoLetivo.create({
    data: { nome: '2026.2', ano: 2026, tipo: 'SEMESTRAL', inicio: d(2026, 8, 3), fim: d(2026, 12, 11), ativo: true },
  });

  // Cursos
  const cursos: Record<string, Curso> = {};
  for (const c of CURSOS) {
    cursos[c.codigo] = await prisma.curso.create({ data: c });
  }

  // Disciplinas (pré-requisitos sempre vêm antes na lista)
  const disciplinas: Record<string, Disciplina> = {};
  for (const s of DISCIPLINAS) {
    const curso = cursos[s.curso];
    const creditos = curso.regime === 'CREDITOS' ? Math.round(s.ch / 15) : 0;
    disciplinas[s.codigo] = await prisma.disciplina.create({
      data: {
        cursoId: curso.id,
        codigo: s.codigo,
        nome: s.nome,
        cargaHoraria: s.ch,
        creditos,
        periodoSugerido: s.periodo,
        obrigatoria: true,
        preRequisitos: s.pre ? { connect: s.pre.map((c) => ({ id: disciplinas[c].id })) } : undefined,
      },
    });
  }

  // Turmas
  const turmas: Record<string, Turma> = {};
  const chaveTurma = (periodo: string, codigo: string): string => `${periodo}|${codigo}`;
  const turmaDe = (periodo: string, codigo: string): Turma => {
    const t = turmas[chaveTurma(periodo, codigo)];
    if (!t) throw new Error(`Turma não criada: ${periodo} ${codigo}`);
    return t;
  };
  const especDisc = (codigo: string): DisciplinaSpec => {
    const s = DISCIPLINAS.find((x) => x.codigo === codigo);
    if (!s) throw new Error(`Disciplina desconhecida: ${codigo}`);
    return s;
  };
  const criarTurma = async (periodo: string, codigoDisc: string, grupo: string | null): Promise<void> => {
    const spec = especDisc(codigoDisc);
    const codigo = `${codigoDisc}-${grupo ?? 'A'}`;
    const sala = HORARIOS.find((h) => h.periodo === periodo && h.turma === codigo)?.sala ?? null;
    turmas[chaveTurma(periodo, codigo)] = await prisma.turma.create({
      data: {
        codigo,
        disciplinaId: disciplinas[codigoDisc].id,
        periodoLetivoId: periodos[periodo].id,
        professorId: profs[spec.prof].id,
        grupo,
        sala,
      },
    });
  };

  // Seriados (2026): uma turma por disciplina e grupo
  for (const s of DISCIPLINAS) {
    const grupo = GRUPO_SERIADO[s.curso];
    if (grupo) await criarTurma('2026', s.codigo, grupo);
  }
  // BCC 2026.1
  for (const c of ['BCC-ALG1', 'BCC-CAL1', 'BCC-ICOMP']) await criarTurma('2026.1', c, null);
  // 2026.2: BCC, ESPDS, MCC e DCC
  const codigos2026_2 = [
    'BCC-ALG2', 'BCC-CAL2', 'BCC-ED', 'BCC-ALG1', 'BCC-CAL1',
    'ESPDS-EST', 'ESPDS-AM', 'ESPDS-VIS',
    'MCC-MP', 'MCC-TIA', 'MCC-SEM',
    'DCC-SEM', 'DCC-SSD', 'DCC-EST',
  ];
  for (const c of codigos2026_2) await criarTurma('2026.2', c, null);

  // Horários (sem choque de professor nem de sala)
  for (const h of HORARIOS) {
    await prisma.horarioAula.create({
      data: {
        turmaId: turmaDe(h.periodo, h.turma).id,
        diaSemana: h.dia,
        horaInicio: h.inicio,
        horaFim: h.fim,
        sala: h.sala,
      },
    });
  }

  // Alunos, matrículas e inscrições
  const alunos: Record<string, { aluno: Aluno; matricula: Matricula }> = {};
  for (const a of ALUNOS) {
    const aluno = await prisma.aluno.create({
      data: {
        ra: a.ra,
        dataNascimento: a.nascimento,
        endereco: a.endereco,
        responsavelNome: a.menor ? `Responsável de ${a.nome}` : undefined,
        responsavelTelefone: a.menor ? proximoFone() : undefined,
        responsavelEmail: a.menor ? `responsavel.${a.ra}@escola.demo` : undefined,
        usuario: {
          create: { nome: a.nome, email: a.email, senhaHash: SENHA_HASH, perfil: 'ALUNO', telefone: proximoFone() },
        },
      },
    });
    const matricula = await prisma.matricula.create({
      data: {
        alunoId: aluno.id,
        cursoId: cursos[a.curso].id,
        periodoIngressoId: periodos[a.ingresso].id,
        serieAtual: a.serie,
      },
    });
    alunos[a.ra] = { aluno, matricula };
  }

  const inscricoes: Record<string, Inscricao> = {};
  const chaveInsc = (ra: string, turmaId: number): string => `${ra}|${turmaId}`;
  const inscricaoDe = (ra: string, turmaId: number): Inscricao => {
    const i = inscricoes[chaveInsc(ra, turmaId)];
    if (!i) throw new Error(`Inscrição não criada: ${ra} turma ${turmaId}`);
    return i;
  };

  // Seriados: CURSANDO em todas as turmas 2026 do grupo do aluno
  for (const a of ALUNOS) {
    if (!a.grupo) continue;
    const turmasDoGrupo = Object.values(turmas).filter(
      (t) => t.grupo === a.grupo && t.periodoLetivoId === periodos['2026'].id
    );
    for (const t of turmasDoGrupo) {
      inscricoes[chaveInsc(a.ra, t.id)] = await prisma.inscricao.create({
        data: { matriculaId: alunos[a.ra].matricula.id, turmaId: t.id, status: 'CURSANDO' },
      });
    }
  }

  // Demais inscrições (BCC, pós e 2026.1)
  for (const s of INSCRICOES_EXPLICITAS) {
    const turma = turmaDe(s.periodo, s.turma);
    inscricoes[chaveInsc(s.ra, turma.id)] = await prisma.inscricao.create({
      data: {
        matriculaId: alunos[s.ra].matricula.id,
        turmaId: turma.id,
        status: s.status,
        notaFinal: s.nota,
        frequencia: s.freq,
      },
    });
  }

  // Avaliações, notas e aulas (diário com conteúdo)
  for (const l of LANCAMENTOS) {
    const turma = turmaDe(l.periodo, l.codigo);
    const p1 = await prisma.avaliacao.create({
      data: { turmaId: turma.id, nome: 'Prova 1', peso: 4, data: l.datas[0], notaMaxima: NOTA_MAXIMA },
    });
    const trabalho = await prisma.avaliacao.create({
      data: { turmaId: turma.id, nome: 'Trabalho', peso: 2, data: l.datas[1], notaMaxima: NOTA_MAXIMA },
    });
    await prisma.avaliacao.create({
      data: { turmaId: turma.id, nome: 'Prova 2', peso: 4, data: l.datas[2], notaMaxima: NOTA_MAXIMA },
    });

    const notas: Prisma.NotaCreateManyInput[] = [];
    for (const a of l.alunos) {
      const insc = inscricaoDe(a.ra, turma.id);
      notas.push({ avaliacaoId: p1.id, inscricaoId: insc.id, valor: a.notas[0] });
      notas.push({ avaliacaoId: trabalho.id, inscricaoId: insc.id, valor: a.notas[1] });
    }
    await prisma.nota.createMany({ data: notas });

    for (let j = 0; j < l.datasAulas.length; j++) {
      await prisma.aula.create({
        data: {
          turmaId: turma.id,
          data: l.datasAulas[j],
          conteudo: CONTEUDOS_AULAS[j],
          presencas: {
            create: l.alunos.map((a) => ({
              inscricaoId: inscricaoDe(a.ra, turma.id).id,
              presente: a.presencas[j],
            })),
          },
        },
      });
    }

    // Recalcula notaFinal e frequencia (regra 5.5 do contrato)
    for (const a of l.alunos) {
      const insc = inscricaoDe(a.ra, turma.id);
      const notaFinal = arred(
        media([
          { valor: a.notas[0], peso: 4 },
          { valor: a.notas[1], peso: 2 },
        ])
      );
      const presentes = a.presencas.filter((p) => p).length;
      const frequencia = arred((presentes / a.presencas.length) * 100);
      await prisma.inscricao.update({ where: { id: insc.id }, data: { notaFinal, frequencia } });
    }
  }

  // Financeiro: bolsa e mensalidades 2026-08 a 2026-12
  const marina = alunos['202600006'];
  await prisma.bolsa.create({
    data: { matriculaId: marina.matricula.id, nome: 'Bolsa Mérito', percentual: 50, inicio: d(2026, 8, 1), ativa: true },
  });

  const RAS_COM_MENSALIDADE = ['202600001', '202600004', '202600005', '202600006', '202600007', '202600008'];
  for (const ra of RAS_COM_MENSALIDADE) {
    const spec = ALUNOS.find((a) => a.ra === ra);
    if (!spec) throw new Error(`Aluno desconhecido: ${ra}`);
    const curso = cursos[spec.curso];
    const matriculaId = alunos[ra].matricula.id;
    const desconto = ra === '202600006' ? (curso.mensalidade * 50) / 100 : 0;
    const ultimoPago = ra === '202600007' ? 9 : 10; // João fica com outubro em aberto
    for (let mes = 8; mes <= 12; mes++) {
      const pago = mes <= ultimoPago;
      const status: StatusMensalidade = pago ? 'PAGA' : 'ABERTA';
      await prisma.mensalidade.create({
        data: {
          matriculaId,
          competencia: `2026-${String(mes).padStart(2, '0')}`,
          vencimento: d(2026, mes, 10),
          valor: curso.mensalidade,
          desconto,
          status,
          pagoEm: pago ? d(2026, mes, 8, 10, 0) : null,
          formaPagamento: pago ? 'Pix' : null,
        },
      });
    }
  }

  // Pós-graduação
  const camila = alunos['202600009'];
  const rafael = alunos['202600010'];
  const beatriz = alunos['202600008'];

  const projCamila = await prisma.projetoPesquisa.create({
    data: {
      matriculaId: camila.matricula.id,
      orientadorId: profs.ana.id,
      titulo: 'Detecção de anomalias em redes com aprendizado profundo',
      resumo: 'Projeto fictício de demonstração sobre detecção de anomalias em tráfego de redes.',
      status: 'EM_ELABORACAO',
    },
  });
  await prisma.banca.create({
    data: {
      projetoId: projCamila.id,
      tipo: 'QUALIFICACAO',
      data: d(2026, 12, 10, 9, 0),
      resultado: 'PENDENTE',
      membros: {
        create: [
          { professorId: profs.ana.id, papel: 'PRESIDENTE' },
          { professorId: profs.diego.id, papel: 'INTERNO' },
          { nomeExterno: 'Dra. Elisa Prado', instituicao: 'Universidade Exemplo', papel: 'EXTERNO' },
        ],
      },
    },
  });

  const projRafael = await prisma.projetoPesquisa.create({
    data: {
      matriculaId: rafael.matricula.id,
      orientadorId: profs.ana.id,
      coorientadorId: profs.diego.id,
      titulo: 'Consenso tolerante a falhas em sistemas distribuídos de larga escala',
      resumo: 'Projeto fictício de demonstração sobre consenso em sistemas distribuídos.',
      status: 'QUALIFICADO',
    },
  });
  await prisma.banca.create({
    data: {
      projetoId: projRafael.id,
      tipo: 'QUALIFICACAO',
      data: d(2026, 10, 20, 14, 0),
      resultado: 'APROVADO_COM_RESSALVAS',
      parecer: 'Aprovado com ressalvas: revisar a fundamentação teórica antes da defesa.',
      membros: {
        create: [
          { professorId: profs.ana.id, papel: 'PRESIDENTE' },
          { professorId: profs.bruno.id, papel: 'INTERNO' },
          { nomeExterno: 'Dr. Otávio Reis', instituicao: 'Universidade Exemplo', papel: 'EXTERNO' },
        ],
      },
    },
  });

  await prisma.projetoPesquisa.create({
    data: {
      matriculaId: beatriz.matricula.id,
      orientadorId: profs.bruno.id,
      titulo: 'Painel de indicadores educacionais com dados abertos',
      resumo: 'Projeto fictício de demonstração sobre painéis de indicadores educacionais.',
      status: 'EM_ELABORACAO',
    },
  });

  // Biblioteca
  const livrosDados: Prisma.LivroCreateInput[] = [
    { titulo: 'Dom Casmurro', autor: 'Machado de Assis', ano: 1899, categoria: 'Literatura', exemplares: 3, disponiveis: 3 },
    { titulo: 'O Cortiço', autor: 'Aluísio Azevedo', ano: 1890, categoria: 'Literatura', exemplares: 2, disponiveis: 2 },
    { titulo: 'Fundamentos de Algoritmos', autor: 'Autoria Demo', categoria: 'Computação', exemplares: 2, disponiveis: 2 },
    { titulo: 'Cálculo: Volume 1', autor: 'Autoria Demo', categoria: 'Matemática', exemplares: 2, disponiveis: 2 },
    { titulo: 'Introdução a Banco de Dados', autor: 'Autoria Demo', categoria: 'Computação', exemplares: 2, disponiveis: 2 },
    { titulo: 'Lógica de Programação Básica', autor: 'Autoria Demo', categoria: 'Computação', exemplares: 1, disponiveis: 1 },
    { titulo: 'Estatística para Ciência de Dados', autor: 'Autoria Demo', categoria: 'Ciência de Dados', exemplares: 2, disponiveis: 2 },
    { titulo: 'Ciências Naturais no Ensino Fundamental', autor: 'Autoria Demo', categoria: 'Ciências', exemplares: 2, disponiveis: 2 },
    { titulo: 'História do Brasil em Resumo', autor: 'Autoria Demo', categoria: 'História', exemplares: 1, disponiveis: 1 },
    { titulo: 'Redes de Computadores em Prática', autor: 'Autoria Demo', categoria: 'Computação', exemplares: 4, disponiveis: 4 },
  ];
  const livros: Record<string, Livro> = {};
  for (const l of livrosDados) {
    livros[l.titulo] = await prisma.livro.create({ data: l });
  }

  const agora = new Date();
  const addAgora = (dias: number): Date => addDias(agora, dias);

  // Empréstimos: dois ativos (um atrasado) e um devolvido
  await prisma.emprestimo.create({
    data: {
      livroId: livros['Fundamentos de Algoritmos'].id,
      usuarioId: marina.aluno.usuarioId,
      retiradoEm: agora,
      devolucaoPrevista: addAgora(14),
      status: 'ATIVO',
    },
  });
  await prisma.livro.update({
    where: { id: livros['Fundamentos de Algoritmos'].id },
    data: { disponiveis: { decrement: 1 } },
  });

  await prisma.emprestimo.create({
    data: {
      livroId: livros['Dom Casmurro'].id,
      usuarioId: alunos['202600001'].aluno.usuarioId,
      retiradoEm: addAgora(-19),
      devolucaoPrevista: addAgora(-5),
      status: 'ATIVO',
    },
  });
  await prisma.livro.update({
    where: { id: livros['Dom Casmurro'].id },
    data: { disponiveis: { decrement: 1 } },
  });

  await prisma.emprestimo.create({
    data: {
      livroId: livros['Cálculo: Volume 1'].id,
      usuarioId: profs.bruno.usuarioId,
      retiradoEm: addAgora(-10),
      devolucaoPrevista: addAgora(4),
      devolvidoEm: addAgora(-3),
      status: 'DEVOLVIDO',
    },
  });

  // Comunicados
  await prisma.comunicado.create({
    data: {
      titulo: 'Boas-vindas ao segundo semestre',
      corpo: 'Seja bem-vindo ao segundo semestre do Instituto Horizonte. Bons estudos a todos!',
      autorId: secretaria.id,
      publico: 'TODOS',
    },
  });
  await prisma.comunicado.create({
    data: {
      titulo: 'Reunião de pais do 6º ano',
      corpo: 'Convidamos os responsáveis para a reunião de pais da turma de Matemática do 6º ano.',
      autorId: secretaria.id,
      publico: 'TURMA',
      turmaId: turmaDe('2026', 'EF2-MAT-6A').id,
    },
  });
  await prisma.comunicado.create({
    data: {
      titulo: 'Entrega do Trabalho de Algoritmos II',
      corpo: 'A entrega do trabalho de Algoritmos II será feita pelo sistema até a data combinada em aula.',
      autorId: profs.ana.usuarioId,
      publico: 'TURMA',
      turmaId: turmaDe('2026.2', 'BCC-ALG2-A').id,
    },
  });
  await prisma.comunicado.create({
    data: {
      titulo: 'Conselho de classe',
      corpo: 'Conselho de classe marcado para o fim do período. Confira a pauta com a coordenação.',
      autorId: admin.id,
      publico: 'PROFESSORES',
    },
  });
  await prisma.comunicado.create({
    data: {
      titulo: 'Inscrições para a Semana da Computação',
      corpo: 'As inscrições para a Semana da Computação estão abertas para alunos do BCC.',
      autorId: secretaria.id,
      publico: 'CURSO',
      cursoId: cursos['BCC'].id,
    },
  });

  // Calendário 2026
  const eventos: Array<{
    titulo: string;
    descricao?: string;
    inicio: Date;
    fim: Date;
    tipo: TipoEvento;
    periodoLetivoId: number | null;
  }> = [
    { titulo: 'Início do ano letivo', inicio: d(2026, 2, 2), fim: d(2026, 2, 2, 23, 59), tipo: 'LETIVO', periodoLetivoId: periodos['2026'].id },
    { titulo: 'Carnaval', inicio: d(2026, 2, 16), fim: d(2026, 2, 17, 23, 59), tipo: 'FERIADO', periodoLetivoId: null },
    { titulo: 'Dia do Professor', inicio: d(2026, 10, 15), fim: d(2026, 10, 15, 23, 59), tipo: 'FERIADO', periodoLetivoId: null },
    { titulo: 'Feira de Ciências', inicio: d(2026, 10, 17, 8, 0), fim: d(2026, 10, 17, 17, 0), tipo: 'EVENTO', periodoLetivoId: periodos['2026'].id },
    { titulo: 'Recesso de julho', inicio: d(2026, 7, 13), fim: d(2026, 7, 31, 23, 59), tipo: 'RECESSO', periodoLetivoId: null },
    { titulo: 'Semana de provas do 2º semestre', inicio: d(2026, 11, 23), fim: d(2026, 11, 27, 23, 59), tipo: 'PROVA', periodoLetivoId: periodos['2026.2'].id },
    { titulo: 'Encerramento do ano letivo', inicio: d(2026, 12, 11), fim: d(2026, 12, 11, 23, 59), tipo: 'LETIVO', periodoLetivoId: periodos['2026'].id },
  ];
  for (const e of eventos) {
    await prisma.eventoCalendario.create({ data: e });
  }

  // ---------- Terceira leva: fórum, suporte, medalhas e log de atividades ----------

  const instanteAtual = Date.now();
  const quando = (horasAtras: number): Date => new Date(instanteAtual - horasAtras * 3600000);
  const quandoMin = (minutosAtras: number): Date => new Date(instanteAtual - minutosAtras * 60000);

  const usuariosDemo = await prisma.usuario.findMany({
    where: {
      email: {
        in: [
          'secretaria@escola.demo',
          'ti@escola.demo',
          'prof.ana@escola.demo',
          'prof.bruno@escola.demo',
          'prof.carla@escola.demo',
          'prof.diego@escola.demo',
          'aluna.marina@escola.demo',
          'aluno.lucas@escola.demo',
          'aluno.joao@escola.demo',
        ],
      },
    },
  });
  const idPorEmail = new Map<string, number>(usuariosDemo.map((u) => [u.email, u.id] as const));
  const idDe = (email: string): number => {
    const id = idPorEmail.get(email);
    if (id === undefined) throw new Error(`Usuário de demonstração não encontrado: ${email}`);
    return id;
  };
  const tiId = idDe('ti@escola.demo');
  const anaId = idDe('prof.ana@escola.demo');
  const brunoId = idDe('prof.bruno@escola.demo');
  const carlaId = idDe('prof.carla@escola.demo');
  const diegoId = idDe('prof.diego@escola.demo');
  const marinaId = idDe('aluna.marina@escola.demo');
  const lucasId = idDe('aluno.lucas@escola.demo');
  const joaoId = idDe('aluno.joao@escola.demo');

  // ----- Fórum -----

  const comunidadesDados = [
    { nome: 'Geral', slug: 'geral', cor: 'azul', descricao: 'Avisos e conversas de toda a escola' },
    { nome: 'Computação', slug: 'computacao', cor: 'roxo', descricao: 'Dúvidas e projetos dos cursos de computação' },
    { nome: 'Ensino Fundamental e Médio', slug: 'fundamental-e-medio', cor: 'verde', descricao: 'Atividades, eventos e estudos' },
    { nome: 'Pós-graduação', slug: 'pos-graduacao', cor: 'laranja', descricao: 'Pesquisa, bancas e eventos acadêmicos' },
  ];
  const comunidades: Record<string, { id: number }> = {};
  for (const c of comunidadesDados) {
    comunidades[c.slug] = await prisma.forumComunidade.create({
      data: { nome: c.nome, slug: c.slug, cor: c.cor, descricao: c.descricao, criadoPorId: secretaria.id },
    });
  }

  const publicacoesDados: { chave: string; comunidade: string; autor: string; titulo: string; corpo: string; ha: number; fixada?: boolean }[] = [
    { chave: 'p1', comunidade: 'geral', autor: 'secretaria@escola.demo', titulo: 'Bem-vindos ao fórum', corpo: 'Este é o espaço da comunidade escolar para avisos e conversas. Escolham a comunidade do assunto e sejam gentis uns com os outros.', ha: 216, fixada: true },
    { chave: 'p2', comunidade: 'computacao', autor: 'aluna.marina@escola.demo', titulo: 'Grupo de estudos de Algoritmos II às terças', corpo: 'Estou montando um grupo de estudos para Algoritmos II, às terças depois da aula. Quem quiser participar, é só responder aqui.', ha: 200 },
    { chave: 'p3', comunidade: 'computacao', autor: 'prof.bruno@escola.demo', titulo: 'Dicas para a prova de Cálculo I', corpo: 'Para a prova, revisem limites e derivadas. A regra da cadeia aparece em quase todos os exercícios da lista 3.', ha: 150 },
    { chave: 'p4', comunidade: 'computacao', autor: 'aluno.joao@escola.demo', titulo: 'Alguém tem material de Estruturas de Dados?', corpo: 'Perdi a aula sobre pilhas e filas. Alguém pode compartilhar as anotações ou os slides?', ha: 96 },
    { chave: 'p5', comunidade: 'fundamental-e-medio', autor: 'prof.diego@escola.demo', titulo: 'Feira de Ciências: ideias de projetos', corpo: 'A Feira de Ciências está chegando. Quem quiser apresentar pode propor um projeto até sexta-feira, com título e uma frase sobre o objetivo.', ha: 120 },
    { chave: 'p6', comunidade: 'fundamental-e-medio', autor: 'prof.carla@escola.demo', titulo: 'Como organizar a rotina de estudos no 6º ano', corpo: 'Uma dica que funciona: escolham um horário fixo de 30 minutos por dia e anotem as tarefas na agenda.', ha: 60 },
    { chave: 'p7', comunidade: 'pos-graduacao', autor: 'prof.ana@escola.demo', titulo: 'Modelos de projeto de pesquisa para a qualificação', corpo: 'Compartilho um modelo de projeto de pesquisa usado nas qualificações anteriores. Ele serve de base, não de receita pronta.', ha: 36 },
    { chave: 'p8', comunidade: 'geral', autor: 'secretaria@escola.demo', titulo: 'Chamada para a Semana da Computação', corpo: 'As inscrições para a Semana da Computação estão abertas para alunos do BCC. Procurem a coordenação do curso para os detalhes.', ha: 24 },
  ];
  const pubs: { key: string; id: number; autorId: number }[] = [];
  for (const p of publicacoesDados) {
    const autorId = idDe(p.autor);
    const criada = await prisma.forumPublicacao.create({
      data: {
        comunidadeId: comunidades[p.comunidade].id,
        autorId,
        titulo: p.titulo,
        corpo: p.corpo,
        fixada: p.fixada ?? false,
        criadoEm: quando(p.ha),
      },
    });
    pubs.push({ key: p.chave, id: criada.id, autorId });
  }

  const comentariosDados: { chave: string; pub: string; pai?: string; autor: string; corpo: string; ha: number }[] = [
    { chave: 'c1', pub: 'p2', autor: 'aluno.joao@escola.demo', corpo: 'Tenho interesse! Posso participar mesmo sem ter feito a primeira parte?', ha: 196 },
    { chave: 'c2', pub: 'p2', pai: 'c1', autor: 'aluna.marina@escola.demo', corpo: 'Pode sim. Vamos revisar listas e ponteiros no começo.', ha: 190 },
    { chave: 'c3', pub: 'p2', pai: 'c2', autor: 'aluno.joao@escola.demo', corpo: 'Perfeito, obrigado!', ha: 186 },
    { chave: 'c4', pub: 'p2', autor: 'prof.ana@escola.demo', corpo: 'Ótima iniciativa. A sala 201 pode ser reservada para os encontros.', ha: 180 },
    { chave: 'c5', pub: 'p3', autor: 'aluna.marina@escola.demo', corpo: 'Alguém sabe se cai derivada implícita na prova?', ha: 120 },
    { chave: 'c6', pub: 'p3', pai: 'c5', autor: 'prof.bruno@escola.demo', corpo: 'Cai sim, com regra da cadeia. Resolvam os exercícios da lista 3.', ha: 110 },
    { chave: 'c7', pub: 'p3', pai: 'c6', autor: 'aluna.marina@escola.demo', corpo: 'Obrigada, professor! Vou refazer os exercícios.', ha: 100 },
    { chave: 'c8', pub: 'p3', autor: 'aluno.joao@escola.demo', corpo: 'Recomendo revisar limites antes das derivadas.', ha: 96 },
    { chave: 'c9', pub: 'p4', autor: 'aluna.marina@escola.demo', corpo: 'Eu tenho as anotações da aula de listas encadeadas. Posso mandar no grupo.', ha: 72 },
    { chave: 'c10', pub: 'p4', pai: 'c9', autor: 'aluno.joao@escola.demo', corpo: 'Seria ótimo! Obrigado.', ha: 70 },
    { chave: 'c11', pub: 'p4', autor: 'prof.ana@escola.demo', corpo: 'Os slides da semana estão no ambiente da disciplina, vale dar uma olhada.', ha: 60 },
    { chave: 'c12', pub: 'p5', autor: 'secretaria@escola.demo', corpo: 'A inscrição de projetos vai até sexta-feira, na secretaria.', ha: 100 },
    { chave: 'c13', pub: 'p5', autor: 'aluno.lucas@escola.demo', corpo: 'Pensei em um projeto sobre reciclagem de papel. Pode ser?', ha: 90 },
    { chave: 'c14', pub: 'p5', pai: 'c13', autor: 'prof.diego@escola.demo', corpo: 'Pode sim, Lucas. Traga um esboço na aula de quinta.', ha: 84 },
    { chave: 'c15', pub: 'p5', pai: 'c14', autor: 'aluno.lucas@escola.demo', corpo: 'Combinado, professor!', ha: 80 },
    { chave: 'c16', pub: 'p6', autor: 'aluno.lucas@escola.demo', corpo: 'Acho difícil conciliar o futebol com as tarefas. Alguma dica?', ha: 48 },
    { chave: 'c17', pub: 'p6', pai: 'c16', autor: 'prof.carla@escola.demo', corpo: 'Experimente um horário fixo de 30 minutos por dia, antes do jantar.', ha: 40 },
    { chave: 'c18', pub: 'p7', autor: 'aluno.joao@escola.demo', corpo: 'Tenho dúvida sobre o modelo de banca. Onde encontro o formulário?', ha: 30 },
    { chave: 'c19', pub: 'p7', pai: 'c18', autor: 'prof.ana@escola.demo', corpo: 'O formulário está na biblioteca de documentos da pós. Vou enviar o link.', ha: 28 },
    { chave: 'c20', pub: 'p8', autor: 'aluna.marina@escola.demo', corpo: 'Vou me inscrever! Tem alguma atividade para iniciantes?', ha: 20 },
  ];
  const coms: { key: string; id: number; pub: string; autorId: number }[] = [];
  for (const c of comentariosDados) {
    const pubAlvo = pubs.find((p) => p.key === c.pub);
    if (!pubAlvo) throw new Error(`Publicação não encontrada: ${c.pub}`);
    let paiId: number | null = null;
    if (c.pai) {
      const pai = coms.find((x) => x.key === c.pai);
      if (!pai || pai.pub !== c.pub) throw new Error(`Pai inválido em ${c.chave}`);
      paiId = pai.id;
    }
    const autorId = idDe(c.autor);
    const criado = await prisma.forumComentario.create({
      data: {
        publicacaoId: pubAlvo.id,
        autorId,
        paiId,
        corpo: c.corpo,
        criadoEm: quando(c.ha),
      },
    });
    coms.push({ key: c.chave, id: criado.id, pub: c.pub, autorId });
  }

  // Votos determinísticos: cada item recebe voto de quem não é o autor (um por usuário por item).
  const votantes = [admin.id, secretaria.id, tiId, anaId, brunoId, carlaId, diegoId, marinaId, lucasId, joaoId];
  const votosPub: { usuarioId: number; publicacaoId: number; valor: number }[] = [];
  pubs.forEach((p, i) => {
    votantes.forEach((u, j) => {
      if (u === p.autorId || (i * 7 + j * 3) % 5 === 0) return;
      votosPub.push({ usuarioId: u, publicacaoId: p.id, valor: (i + j) % 4 === 0 ? -1 : 1 });
    });
  });
  const votosCom: { usuarioId: number; comentarioId: number; valor: number }[] = [];
  coms.forEach((c, k) => {
    votantes.forEach((u, j) => {
      if (u === c.autorId || (k * 5 + j * 2) % 4 === 0) return;
      votosCom.push({ usuarioId: u, comentarioId: c.id, valor: (k + j) % 3 === 0 ? -1 : 1 });
    });
  });
  await prisma.forumVoto.createMany({ data: votosPub });
  await prisma.forumVoto.createMany({ data: votosCom });

  // Totais: pontos = soma dos votos; comentarios = quantidade de comentários da publicação.
  for (const p of pubs) {
    const pontos = votosPub.filter((v) => v.publicacaoId === p.id).reduce((s, v) => s + v.valor, 0);
    const comentarios = coms.filter((c) => c.pub === p.key).length;
    await prisma.forumPublicacao.update({ where: { id: p.id }, data: { pontos, comentarios } });
  }
  for (const c of coms) {
    const pontos = votosCom.filter((v) => v.comentarioId === c.id).reduce((s, v) => s + v.valor, 0);
    await prisma.forumComentario.update({ where: { id: c.id }, data: { pontos } });
  }

  // ----- Suporte (chamados) -----

  type MsgDado = { autor: string; daEquipe: boolean; ha: number; texto: string };
  type ChamadoDado = {
    autor: string;
    categoria: 'TECNICO' | 'SECRETARIA' | 'FINANCEIRO' | 'ACADEMICO';
    turma: boolean;
    assunto: string;
    prioridade: 'BAIXA' | 'NORMAL' | 'ALTA';
    status: 'ABERTO' | 'EM_ATENDIMENTO' | 'AGUARDANDO_USUARIO' | 'RESOLVIDO' | 'FECHADO';
    responsavel?: string;
    avaliacao?: number;
    avaliacaoComentario?: string;
    lidoAutorHa?: number;
    lidoEquipeHa?: number;
    mensagens: MsgDado[];
  };
  const chamadosDados: ChamadoDado[] = [
    {
      autor: 'aluna.marina@escola.demo', categoria: 'TECNICO', turma: false, assunto: 'Não consigo ver meu boletim no celular', prioridade: 'ALTA', status: 'EM_ATENDIMENTO', responsavel: 'ti@escola.demo', lidoEquipeHa: 46,
      mensagens: [
        { autor: 'aluna.marina@escola.demo', daEquipe: false, ha: 50, texto: 'Abro o boletim pelo celular e a tela fica em branco depois do login. No computador funciona.' },
        { autor: 'ti@escola.demo', daEquipe: true, ha: 46, texto: 'Obrigado por avisar, Marina. Qual navegador você está usando no celular?' },
        { autor: 'ti@escola.demo', daEquipe: true, ha: 30, texto: 'Conseguimos reproduzir o problema e já corrigimos. Pode testar de novo e nos avisar?' },
      ],
    },
    {
      autor: 'aluno.lucas@escola.demo', categoria: 'SECRETARIA', turma: false, assunto: 'Declaração de matrícula', prioridade: 'NORMAL', status: 'RESOLVIDO', responsavel: 'secretaria@escola.demo', lidoAutorHa: 70, lidoEquipeHa: 72,
      mensagens: [
        { autor: 'aluno.lucas@escola.demo', daEquipe: false, ha: 120, texto: 'Preciso de uma declaração de matrícula para entregar no banco. Como faço o pedido?' },
        { autor: 'secretaria@escola.demo', daEquipe: true, ha: 118, texto: 'Você pode pedir por aqui mesmo. Informe o período letivo que deve constar na declaração.' },
        { autor: 'secretaria@escola.demo', daEquipe: true, ha: 72, texto: 'Declaração emitida e disponível na secretaria.' },
      ],
    },
    {
      autor: 'aluno.joao@escola.demo', categoria: 'FINANCEIRO', turma: false, assunto: 'Segunda via da mensalidade de outubro', prioridade: 'NORMAL', status: 'ABERTO',
      mensagens: [
        { autor: 'aluno.joao@escola.demo', daEquipe: false, ha: 20, texto: 'Não encontrei a segunda via da mensalidade de outubro no painel. Podem enviar por aqui?' },
      ],
    },
    {
      autor: 'aluna.marina@escola.demo', categoria: 'ACADEMICO', turma: true, assunto: 'Dúvida sobre o trabalho', prioridade: 'NORMAL', status: 'AGUARDANDO_USUARIO', responsavel: 'prof.ana@escola.demo', lidoEquipeHa: 40,
      mensagens: [
        { autor: 'aluna.marina@escola.demo', daEquipe: false, ha: 60, texto: 'Professora, o trabalho final pode ser feito em dupla?' },
        { autor: 'prof.ana@escola.demo', daEquipe: true, ha: 40, texto: 'Pode sim, desde que a dupla entregue a mesma versão no prazo. Quem são os integrantes?' },
      ],
    },
    {
      autor: 'prof.bruno@escola.demo', categoria: 'TECNICO', turma: false, assunto: 'Projetor da Sala 201', prioridade: 'BAIXA', status: 'FECHADO', responsavel: 'ti@escola.demo', avaliacao: 5, avaliacaoComentario: 'Resolvido rápido, obrigado.', lidoAutorHa: 120, lidoEquipeHa: 136,
      mensagens: [
        { autor: 'prof.bruno@escola.demo', daEquipe: false, ha: 140, texto: 'O projetor da Sala 201 não liga. Alguém pode verificar antes da aula das 14h?' },
        { autor: 'ti@escola.demo', daEquipe: true, ha: 136, texto: 'Vamos até a sala agora. Pode ser o cabo HDMI solto.' },
        { autor: 'prof.bruno@escola.demo', daEquipe: false, ha: 120, texto: 'Funcionou, obrigado! O cabo estava solto mesmo.' },
      ],
    },
  ];
  const turmaAlg2 = turmaDe('2026.2', 'BCC-ALG2-A');
  for (const c of chamadosDados) {
    const ultima = c.mensagens[c.mensagens.length - 1];
    const chamado = await prisma.chamado.create({
      data: {
        autorId: idDe(c.autor),
        categoria: c.categoria,
        turmaId: c.turma ? turmaAlg2.id : null,
        assunto: c.assunto,
        prioridade: c.prioridade,
        status: c.status,
        responsavelId: c.responsavel ? idDe(c.responsavel) : null,
        avaliacao: c.avaliacao ?? null,
        avaliacaoComentario: c.avaliacaoComentario ?? null,
        criadoEm: quando(c.mensagens[0].ha),
        atualizadoEm: quando(ultima.ha),
        ultimaMensagemEm: quando(ultima.ha),
        ultimaMensagemEquipe: ultima.daEquipe,
        lidoPeloAutorEm: c.lidoAutorHa !== undefined ? quando(c.lidoAutorHa) : null,
        lidoPelaEquipeEm: c.lidoEquipeHa !== undefined ? quando(c.lidoEquipeHa) : null,
      },
    });
    await prisma.chamadoMensagem.createMany({
      data: c.mensagens.map((m) => ({
        chamadoId: chamado.id,
        autorId: idDe(m.autor),
        daEquipe: m.daEquipe,
        texto: m.texto,
        criadoEm: quando(m.ha),
      })),
    });
  }

  // ----- Medalhas manuais -----

  await prisma.medalhaConcedida.createMany({
    data: [
      { usuarioId: marinaId, concedidaPorId: anaId, titulo: 'Destaque do semestre', descricao: 'Melhor desempenho da turma de Algoritmos II.', icone: 'estrela', cor: 'laranja', pontos: 30 },
      { usuarioId: lucasId, concedidaPorId: secretaria.id, titulo: 'Colaborador da Feira de Ciências', descricao: 'Ajudou a organizar a feira de 2026.', icone: 'medalha', cor: 'verde', pontos: 20 },
      { usuarioId: anaId, concedidaPorId: admin.id, titulo: 'Professora homenageada', descricao: 'Escolhida pelos formandos de 2026.', icone: 'estrela', cor: 'roxo', pontos: 30 },
    ],
  });

  // ----- Log de atividades -----

  type PerfilLog = 'ADMIN' | 'SECRETARIA' | 'TI' | 'PROFESSOR' | 'ALUNO';
  interface ModeloLog { tipo: string; modulo: string; descricao: string; metodo: string; caminho: string; status: number; perfis: PerfilLog[] }
  interface AtorLog { id: number; nome: string; perfil: PerfilLog }
  interface RegistroLog {
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
    criadoEm: Date;
  }
  const STAFF: PerfilLog[] = ['ADMIN', 'SECRETARIA', 'TI', 'PROFESSOR'];
  const modelos: ModeloLog[] = [
    { tipo: 'LOGIN', modulo: 'Sessão', descricao: 'Entrou no sistema', metodo: 'POST', caminho: '/api/auth/login', status: 200, perfis: ['ADMIN', 'SECRETARIA', 'TI', 'PROFESSOR', 'ALUNO'] },
    { tipo: 'TELA', modulo: 'Painel', descricao: 'Abriu a tela Painel', metodo: 'GET', caminho: '/painel', status: 200, perfis: STAFF },
    { tipo: 'TELA', modulo: 'Alunos', descricao: 'Abriu a tela Alunos', metodo: 'GET', caminho: '/alunos', status: 200, perfis: STAFF },
    { tipo: 'TELA', modulo: 'Turmas', descricao: 'Abriu a tela Turmas', metodo: 'GET', caminho: '/turmas', status: 200, perfis: STAFF },
    { tipo: 'CONSULTA', modulo: 'Turmas', descricao: 'Consultou Turmas', metodo: 'GET', caminho: '/api/turmas', status: 200, perfis: STAFF },
    { tipo: 'CRIACAO', modulo: 'Comunicados', descricao: 'Criou um registro em Comunicados', metodo: 'POST', caminho: '/api/comunicados', status: 201, perfis: ['ADMIN', 'SECRETARIA'] },
    { tipo: 'ALTERACAO', modulo: 'Avaliações', descricao: 'Lançou notas', metodo: 'POST', caminho: '/api/avaliacoes/notas', status: 200, perfis: ['PROFESSOR'] },
    { tipo: 'ALTERACAO', modulo: 'Mensalidades', descricao: 'Registrou pagamento de mensalidade', metodo: 'POST', caminho: '/api/mensalidades/pagar', status: 200, perfis: ['ADMIN', 'SECRETARIA'] },
    { tipo: 'CRIACAO', modulo: 'Biblioteca', descricao: 'Criou um registro em Biblioteca', metodo: 'POST', caminho: '/api/livros', status: 201, perfis: ['ADMIN', 'SECRETARIA'] },
    { tipo: 'TELA', modulo: 'Boletim', descricao: 'Abriu a tela Boletim', metodo: 'GET', caminho: '/boletim', status: 200, perfis: ['ALUNO'] },
    { tipo: 'CONSULTA', modulo: 'Boletim', descricao: 'Consultou Boletim', metodo: 'GET', caminho: '/api/boletim', status: 200, perfis: ['ALUNO'] },
    { tipo: 'TELA', modulo: 'Suporte', descricao: 'Abriu a tela Suporte', metodo: 'GET', caminho: '/suporte', status: 200, perfis: ['ADMIN', 'SECRETARIA', 'TI', 'PROFESSOR', 'ALUNO'] },
  ];
  const modeloExclusao: ModeloLog = { tipo: 'EXCLUSAO', modulo: 'Comunicados', descricao: 'Excluiu um registro em Comunicados', metodo: 'DELETE', caminho: '/api/comunicados', status: 200, perfis: ['SECRETARIA'] };
  const atores: AtorLog[] = [
    { id: admin.id, nome: 'Administrador Demo', perfil: 'ADMIN' },
    { id: secretaria.id, nome: 'Secretaria Demo', perfil: 'SECRETARIA' },
    { id: tiId, nome: 'Suporte de TI Demo', perfil: 'TI' },
    { id: anaId, nome: 'Ana Ribeiro', perfil: 'PROFESSOR' },
    { id: brunoId, nome: 'Bruno Tavares', perfil: 'PROFESSOR' },
    { id: marinaId, nome: 'Marina Costa', perfil: 'ALUNO' },
    { id: lucasId, nome: 'Lucas Pereira', perfil: 'ALUNO' },
    { id: joaoId, nome: 'João Vieira', perfil: 'ALUNO' },
  ];
  const registroDe = (ator: AtorLog, m: ModeloLog, minutosAtras: number, n: number): RegistroLog => ({
    usuarioId: ator.id,
    usuarioNome: ator.nome,
    perfil: ator.perfil,
    tipo: m.tipo,
    modulo: m.modulo,
    descricao: m.descricao,
    metodo: m.metodo,
    caminho: m.caminho,
    status: m.status,
    duracaoMs: 40 + ((n * 131) % 900),
    ip: `192.168.0.${10 + (n % 40)}`,
    navegador: 'Navegador de demonstração',
    criadoEm: quandoMin(minutosAtras),
  });

  const registros: RegistroLog[] = [];
  for (let n = 0; n < 56; n += 1) {
    const ator = atores[n % atores.length];
    const candidatos = modelos.filter((m) => m.perfis.includes(ator.perfil));
    const modelo = candidatos[(n * 3) % candidatos.length];
    // Dois terços entre 2h e 12h atrás (horário comercial); o resto espalhado nas 24h.
    const minutos = n % 3 !== 0 ? 120 + ((n * 47) % 600) : 10 + ((n * 53) % 1370);
    registros.push(registroDe(ator, modelo, minutos, n));
  }
  // Online agora: 4 registros nos últimos 4 minutos.
  const modeloBoletim = modelos.find((m) => m.caminho === '/boletim');
  const modeloTurmas = modelos.find((m) => m.modulo === 'Turmas' && m.tipo === 'TELA');
  const modeloAlunos = modelos.find((m) => m.modulo === 'Alunos');
  const modeloNotas = modelos.find((m) => m.descricao === 'Lançou notas');
  if (!modeloBoletim || !modeloTurmas || !modeloAlunos || !modeloNotas) throw new Error('Modelo de log ausente');
  registros.push(registroDe(atores[5], modeloBoletim, 3, 56));
  registros.push(registroDe(atores[3], modeloTurmas, 2, 57));
  registros.push(registroDe(atores[3], modeloNotas, 1, 58));
  registros.push(registroDe(atores[1], modeloAlunos, 2, 59));
  // Duas falhas de login (sem usuário associado).
  const falhas: [string, number, number][] = [['visitante.demo@escola.demo', 300, 60], ['aluno.teste@escola.demo', 900, 61]];
  for (const [email, minutos, n] of falhas) {
    registros.push({
      usuarioId: null,
      usuarioNome: null,
      perfil: null,
      tipo: 'FALHA_LOGIN',
      modulo: 'Sessão',
      descricao: `Tentativa de login sem sucesso: ${email}`,
      metodo: 'POST',
      caminho: '/api/auth/login',
      status: 401,
      duracaoMs: 60 + n,
      ip: '192.168.0.99',
      navegador: 'Navegador de demonstração',
      criadoEm: quandoMin(minutos),
    });
  }
  // Uma exclusão.
  registros.push(registroDe(atores[1], modeloExclusao, 600, 62));
  await prisma.logAtividade.createMany({ data: registros });

  // ----- Chat privado -----

  type ParticipanteChatDado = { usuarioId: number; admin?: boolean; entrouHa: number; leituraHa: number | null };
  type MsgChatDado = { autorId: number; ha: number; texto: string; sistema?: boolean; apagadaHa?: number; respostaDe?: number };

  const chatChave = (a: number, b: number): string => `${Math.min(a, b)}:${Math.max(a, b)}`;
  const chatSecretariaId = idDe('secretaria@escola.demo');

  // Entrega = agora para todos; leitura conforme o dado de cada participante.
  const chatCriarConversa = async (dados: {
    tipo: 'INDIVIDUAL' | 'GRUPO';
    nome?: string;
    chaveIndividual?: string;
    criadoPorId: number;
    criadaHa: number;
    atualizadaHa: number;
    participantes: ParticipanteChatDado[];
  }): Promise<number> => {
    const conversa = await prisma.chatConversa.create({
      data: {
        tipo: dados.tipo,
        nome: dados.nome ?? null,
        chaveIndividual: dados.chaveIndividual ?? null,
        criadoPorId: dados.criadoPorId,
        criadaEm: quando(dados.criadaHa),
        atualizadaEm: quando(dados.atualizadaHa),
        participantes: {
          create: dados.participantes.map((p) => ({
            usuarioId: p.usuarioId,
            admin: p.admin ?? false,
            entrouEm: quando(p.entrouHa),
            ultimaEntregaEm: new Date(instanteAtual),
            ultimaLeituraEm: p.leituraHa !== null ? quando(p.leituraHa) : null,
          })),
        },
      },
    });
    return conversa.id;
  };

  // Grava as mensagens em ordem; respostaDe é o índice de uma mensagem anterior da mesma lista.
  const chatGravar = async (conversaId: number, mensagens: MsgChatDado[]): Promise<void> => {
    const gravadas: number[] = [];
    for (const m of mensagens) {
      const criada = await prisma.chatMensagem.create({
        data: {
          conversaId,
          autorId: m.autorId,
          texto: m.texto,
          sistema: m.sistema ?? false,
          respostaAId: m.respostaDe !== undefined ? gravadas[m.respostaDe] : null,
          criadaEm: quando(m.ha),
          apagadaEm: m.apagadaHa !== undefined ? quando(m.apagadaHa) : null,
        },
      });
      gravadas.push(criada.id);
    }
  };

  // Individual: Marina com a professora Ana (6 mensagens; a última da Ana ainda não lida pela Marina).
  const conversaMarinaAna = await chatCriarConversa({
    tipo: 'INDIVIDUAL',
    chaveIndividual: chatChave(marinaId, anaId),
    criadoPorId: marinaId,
    criadaHa: 30,
    atualizadaHa: 2,
    participantes: [
      { usuarioId: marinaId, entrouHa: 31, leituraHa: 24 },
      { usuarioId: anaId, entrouHa: 31, leituraHa: 2 },
    ],
  });
  await chatGravar(conversaMarinaAna, [
    { autorId: marinaId, ha: 30, texto: 'Professora Ana, posso tirar uma dúvida sobre o trabalho final?' },
    { autorId: anaId, ha: 28, texto: 'Claro, Marina. Qual é a dúvida?' },
    { autorId: marinaId, ha: 26, texto: 'Preciso saber se a parte de ordenação entra no trabalho ou só a de árvores.' },
    { autorId: anaId, ha: 25.5, texto: 'Entra a ordenação também. A árvore é a parte principal, mas a comparação dos métodos conta.' },
    { autorId: marinaId, ha: 24, texto: 'Entendi. Posso fazer o trabalho em dupla?' },
    { autorId: anaId, ha: 2, texto: 'Pode sim, desde que a dupla entregue a mesma versão no prazo.' },
  ]);

  // Individual: Marina com Lucas (4 mensagens, tudo lido).
  const conversaMarinaLucas = await chatCriarConversa({
    tipo: 'INDIVIDUAL',
    chaveIndividual: chatChave(marinaId, lucasId),
    criadoPorId: lucasId,
    criadaHa: 20,
    atualizadaHa: 18.5,
    participantes: [
      { usuarioId: marinaId, entrouHa: 21, leituraHa: 18.5 },
      { usuarioId: lucasId, entrouHa: 21, leituraHa: 18.5 },
    ],
  });
  await chatGravar(conversaMarinaLucas, [
    { autorId: lucasId, ha: 20, texto: 'Oi, Marina! Você viu o aviso sobre a Feira de Ciências no fórum?' },
    { autorId: marinaId, ha: 19.5, texto: 'Vi sim, Lucas. A inscrição dos projetos vai até sexta-feira, na secretaria.' },
    { autorId: lucasId, ha: 19, texto: 'Obrigado! Vou levar o esboço do meu projeto na quinta.' },
    { autorId: marinaId, ha: 18.5, texto: 'Boa sorte! Qualquer dúvida, é só chamar.' },
  ]);

  // Individual: secretaria com o professor Bruno (3 mensagens; a última do Bruno ainda não lida pela secretaria).
  const conversaSecretariaBruno = await chatCriarConversa({
    tipo: 'INDIVIDUAL',
    chaveIndividual: chatChave(chatSecretariaId, brunoId),
    criadoPorId: chatSecretariaId,
    criadaHa: 10,
    atualizadaHa: 3,
    participantes: [
      { usuarioId: chatSecretariaId, entrouHa: 11, leituraHa: 9 },
      { usuarioId: brunoId, entrouHa: 11, leituraHa: 3 },
    ],
  });
  await chatGravar(conversaSecretariaBruno, [
    { autorId: chatSecretariaId, ha: 10, texto: 'Professor Bruno, o diário de Cálculo I já foi atualizado?' },
    { autorId: brunoId, ha: 9, texto: 'Ainda não. Vou lançar as notas da prova 2 até amanhã.' },
    { autorId: brunoId, ha: 3, texto: 'Lançamento feito. Pode conferir no sistema quando tiver um tempo.' },
  ]);

  // Grupo: Turma de Algoritmos II, criado pela professora Ana (administradora), com Marina e João.
  const grupoAlgoritmosII = await chatCriarConversa({
    tipo: 'GRUPO',
    nome: 'Turma de Algoritmos II',
    criadoPorId: anaId,
    criadaHa: 40,
    atualizadaHa: 4,
    participantes: [
      { usuarioId: anaId, admin: true, entrouHa: 41, leituraHa: 4 },
      { usuarioId: marinaId, entrouHa: 41, leituraHa: 20 },
      { usuarioId: joaoId, entrouHa: 41, leituraHa: 4 },
    ],
  });
  await chatGravar(grupoAlgoritmosII, [
    { autorId: anaId, ha: 40, texto: 'Ana Ribeiro criou o grupo', sistema: true },
    { autorId: anaId, ha: 38, texto: 'Pessoal, este grupo é para as dúvidas da turma de Algoritmos II.' },
    { autorId: marinaId, ha: 36, texto: 'Ótimo! Vou trazer as dúvidas sobre listas encadeadas.' },
    { autorId: joaoId, ha: 34, texto: 'Eu também tenho dúvida sobre pilhas e filas. Alguém pode explicar?' },
    { autorId: anaId, ha: 30, texto: 'Claro. Na aula de quinta revisamos esse conteúdo com exemplos.' },
    { autorId: marinaId, ha: 26, texto: 'Podemos estudar juntos antes da prova, João.', respostaDe: 3 },
    { autorId: joaoId, ha: 20, texto: 'Combinado! Podemos marcar uma revisão na terça, depois da aula.' },
    { autorId: anaId, ha: 12, texto: 'Enviei o link do material errado, desculpem. Corrijo na próxima mensagem.', apagadaHa: 11 },
    { autorId: anaId, ha: 4, texto: 'Material da semana publicado no ambiente da disciplina.' },
  ]);

  // ----- Central de notificações (avisos de demonstração, nas últimas 48 horas) -----

  const nomeDemo = (email: string): string => {
    const u = usuariosDemo.find((x) => x.email === email);
    if (!u) throw new Error(`Usuário de demonstração não encontrado: ${email}`);
    return u.nome;
  };
  const postDemo = (chave: string): number => {
    const p = pubs.find((x) => x.key === chave);
    if (!p) throw new Error(`Publicação não encontrada: ${chave}`);
    return p.id;
  };
  const dataBr = (x: Date): string =>
    `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;

  type AvisoDado = {
    email: string;
    tipo: 'COMUNICADO' | 'SUPORTE' | 'FORUM' | 'NOTA' | 'FINANCEIRO' | 'MEDALHA' | 'BIBLIOTECA';
    titulo: string;
    texto: string;
    link: string | null;
    ha: number;
    lidaHa?: number;
  };
  const avisosDados: AvisoDado[] = [
    // Aluna Marina
    { email: 'aluna.marina@escola.demo', tipo: 'NOTA', titulo: 'Nota lançada em Algoritmos II', texto: 'Confira a nota no boletim.', link: '/boletim', ha: 26, lidaHa: 25 },
    { email: 'aluna.marina@escola.demo', tipo: 'SUPORTE', titulo: 'Nova resposta no chamado: Não consigo ver meu boletim no celular', texto: 'A equipe respondeu o seu chamado. Abra o menu do usuário para ver a conversa.', link: null, ha: 30 },
    { email: 'aluna.marina@escola.demo', tipo: 'BIBLIOTECA', titulo: `Empréstimo registrado: Fundamentos de Algoritmos, devolução até ${dataBr(addAgora(14))}`, texto: 'Confira seus empréstimos na biblioteca.', link: '/biblioteca', ha: 0.5, lidaHa: 0.2 },
    // Professora Ana
    { email: 'prof.ana@escola.demo', tipo: 'COMUNICADO', titulo: 'Conselho de classe', texto: 'Confira a pauta com a coordenação.', link: '/comunicados', ha: 22, lidaHa: 21 },
    { email: 'prof.ana@escola.demo', tipo: 'FORUM', titulo: `${nomeDemo('aluno.joao@escola.demo')} comentou em: Modelos de projeto de pesquisa para a qualificação`, texto: 'Veja o comentário e responda, se quiser.', link: `/forum/p/${postDemo('p7')}`, ha: 28 },
    { email: 'prof.ana@escola.demo', tipo: 'SUPORTE', titulo: 'Nova resposta no chamado: Dúvida sobre o trabalho', texto: 'A aluna respondeu a sua última mensagem.', link: '/atendimento', ha: 6, lidaHa: 5 },
    // Secretaria
    { email: 'secretaria@escola.demo', tipo: 'SUPORTE', titulo: 'Nova resposta no chamado: Segunda via da mensalidade de outubro', texto: 'O aluno enviou uma nova mensagem no atendimento.', link: '/atendimento', ha: 20, lidaHa: 19 },
    { email: 'secretaria@escola.demo', tipo: 'FORUM', titulo: `${nomeDemo('aluna.marina@escola.demo')} comentou em: Chamada para a Semana da Computação`, texto: 'Veja o comentário e responda, se quiser.', link: `/forum/p/${postDemo('p8')}`, ha: 20 },
    // Aluno Lucas
    { email: 'aluno.lucas@escola.demo', tipo: 'COMUNICADO', titulo: 'Boas-vindas ao segundo semestre', texto: 'Bons estudos a todos!', link: '/comunicados', ha: 40, lidaHa: 39 },
    { email: 'aluno.lucas@escola.demo', tipo: 'FORUM', titulo: `${nomeDemo('prof.carla@escola.demo')} comentou em: Como organizar a rotina de estudos no 6º ano`, texto: 'Veja o comentário e responda, se quiser.', link: `/forum/p/${postDemo('p6')}`, ha: 40 },
    { email: 'aluno.lucas@escola.demo', tipo: 'FINANCEIRO', titulo: 'Nova mensalidade de 2026-11', texto: 'Confira o valor e o vencimento no financeiro.', link: '/financeiro', ha: 44 },
    { email: 'aluno.lucas@escola.demo', tipo: 'MEDALHA', titulo: 'Você recebeu a medalha Colaborador da Feira de Ciências', texto: 'Veja suas medalhas no perfil.', link: '/perfil', ha: 10 },
  ];
  await prisma.notificacao.createMany({
    data: avisosDados.map((a) => ({
      usuarioId: idDe(a.email),
      tipo: a.tipo,
      titulo: a.titulo,
      texto: a.texto,
      link: a.link,
      criadaEm: quando(a.ha),
      lidaEm: a.lidaHa !== undefined ? quando(a.lidaHa) : null,
    })),
  });

  // Resumo
  console.log(
    `Dados de demonstração carregados: ${await prisma.usuario.count()} usuários, ${await prisma.turma.count()} turmas, ${await prisma.matricula.count()} matrículas.`
  );
}

