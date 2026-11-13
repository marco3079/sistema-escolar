import { prisma } from './prisma';
import { HttpError } from './erros';

// Boletim e histórico de uma matrícula. Usado pelo diário, pelos documentos em PDF e pelo portal dos responsáveis.
// Quem chama confere a permissão antes.

// MatriculaDTO (contrato 5.4)
export const incluirMatricula = {
  aluno: { select: { id: true, ra: true, usuario: { select: { nome: true } } } },
  curso: { select: { id: true, nome: true, nivel: true, regime: true } },
  periodoIngresso: { select: { id: true, nome: true } },
} as const;

export function paraMatriculaResposta(matricula: {
  id: number;
  alunoId: number;
  cursoId: number;
  periodoIngressoId: number;
  dataMatricula: Date;
  status: string;
  serieAtual: number;
  aluno: { id: number; ra: string; usuario: { nome: string } };
  curso: { id: number; nome: string; nivel: string; regime: string };
  periodoIngresso: { id: number; nome: string };
}) {
  return {
    id: matricula.id,
    alunoId: matricula.alunoId,
    cursoId: matricula.cursoId,
    periodoIngressoId: matricula.periodoIngressoId,
    dataMatricula: matricula.dataMatricula,
    status: matricula.status,
    serieAtual: matricula.serieAtual,
    aluno: {
      id: matricula.aluno.id,
      ra: matricula.aluno.ra,
      usuario: { nome: matricula.aluno.usuario.nome },
    },
    curso: matricula.curso,
    periodoIngresso: matricula.periodoIngresso,
  };
}

// BoletimDTO (contrato 5.5)
export async function montarBoletim(matriculaId: number) {
  const matricula = await prisma.matricula.findUnique({
    where: { id: matriculaId },
    include: incluirMatricula,
  });
  if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');

  const inscricoes = await prisma.inscricao.findMany({
    where: { matriculaId },
    include: {
      notas: true,
      turma: {
        include: {
          disciplina: { select: { nome: true, codigo: true } },
          periodoLetivo: { select: { id: true, nome: true, inicio: true } },
          professor: { select: { usuario: { select: { nome: true } } } },
          avaliacoes: { orderBy: { data: 'asc' } },
        },
      },
    },
  });

  const grupos = new Map<
    number,
    {
      periodo: { id: number; nome: string };
      inicio: Date;
      itens: {
        inscricaoId: number;
        disciplina: string;
        codigo: string;
        turma: string;
        professor: string;
        avaliacoes: { nome: string; peso: number; notaMaxima: number; valor: number | null }[];
        notaFinal: number | null;
        frequencia: number | null;
        status: string;
      }[];
    }
  >();

  for (const i of inscricoes) {
    const t = i.turma;
    const notaPorAvaliacao = new Map<number, number>();
    for (const n of i.notas) notaPorAvaliacao.set(n.avaliacaoId, n.valor);

    const item = {
      inscricaoId: i.id,
      disciplina: t.disciplina.nome,
      codigo: t.disciplina.codigo,
      turma: t.codigo,
      professor: t.professor.usuario.nome,
      avaliacoes: t.avaliacoes.map((a) => ({
        nome: a.nome,
        peso: a.peso,
        notaMaxima: a.notaMaxima,
        valor: notaPorAvaliacao.get(a.id) ?? null,
      })),
      notaFinal: i.notaFinal,
      frequencia: i.frequencia,
      status: i.status,
    };

    let grupo = grupos.get(t.periodoLetivo.id);
    if (!grupo) {
      grupo = {
        periodo: { id: t.periodoLetivo.id, nome: t.periodoLetivo.nome },
        inicio: t.periodoLetivo.inicio,
        itens: [],
      };
      grupos.set(t.periodoLetivo.id, grupo);
    }
    grupo.itens.push(item);
  }

  const periodos = Array.from(grupos.values())
    .sort((a, b) => b.inicio.getTime() - a.inicio.getTime())
    .map((g) => ({
      periodo: g.periodo,
      itens: g.itens.sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR')),
    }));

  return { matricula: paraMatriculaResposta(matricula), periodos };
}

// HistoricoDTO (contrato 5.5)
export async function montarHistorico(matriculaId: number) {
  const matricula = await prisma.matricula.findUnique({
    where: { id: matriculaId },
    include: incluirMatricula,
  });
  if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');

  const inscricoes = await prisma.inscricao.findMany({
    where: { matriculaId, status: { not: 'TRANCADO' } },
    include: {
      turma: {
        include: {
          disciplina: true,
          periodoLetivo: { select: { nome: true, inicio: true } },
        },
      },
    },
  });

  inscricoes.sort((a, b) => {
    const porPeriodo = b.turma.periodoLetivo.inicio.getTime() - a.turma.periodoLetivo.inicio.getTime();
    if (porPeriodo !== 0) return porPeriodo;
    return a.turma.disciplina.codigo.localeCompare(b.turma.disciplina.codigo, 'pt-BR');
  });

  const itens = inscricoes.map((i) => ({
    periodo: i.turma.periodoLetivo.nome,
    codigo: i.turma.disciplina.codigo,
    disciplina: i.turma.disciplina.nome,
    cargaHoraria: i.turma.disciplina.cargaHoraria,
    creditos: i.turma.disciplina.creditos,
    notaFinal: i.notaFinal,
    frequencia: i.frequencia,
    status: i.status,
  }));

  let creditosConcluidos = 0;
  let cargaHorariaConcluida = 0;
  let somaPonderada = 0;
  let somaCargaHoraria = 0;
  for (const i of inscricoes) {
    const d = i.turma.disciplina;
    if (i.status === 'APROVADO') {
      creditosConcluidos += d.creditos;
      cargaHorariaConcluida += d.cargaHoraria;
    }
    const avaliada =
      i.status === 'APROVADO' || i.status === 'REPROVADO_NOTA' || i.status === 'REPROVADO_FALTA';
    if (avaliada && i.notaFinal !== null) {
      somaPonderada += i.notaFinal * d.cargaHoraria;
      somaCargaHoraria += d.cargaHoraria;
    }
  }
  const coeficiente =
    somaCargaHoraria > 0 ? Math.round((somaPonderada / somaCargaHoraria) * 100) / 100 : null;

  return {
    matricula: paraMatriculaResposta(matricula),
    itens,
    resumo: { creditosConcluidos, cargaHorariaConcluida, coeficiente },
  };
}

export type BoletimDTO = Awaited<ReturnType<typeof montarBoletim>>;
export type HistoricoDTO = Awaited<ReturnType<typeof montarHistorico>>;
