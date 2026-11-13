import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam } from '../../lib/erros';
import { permitir } from '../../lib/auth';

const router = Router();

// Fichas do aluno e do professor (formato em docs/plano/i-g05-fichas-api.md).
// GET /api/alunos/:id/ficha e GET /api/professores/:id/ficha.

// ---------- Tipos de linhas carregadas ----------

interface MensalidadeLinha {
  id: number;
  competencia: string;
  vencimento: Date;
  valor: number;
  desconto: number;
  status: string;
}

interface EmprestimoLinha {
  id: number;
  retiradoEm: Date;
  devolucaoPrevista: Date;
  devolvidoEm: Date | null;
  status: string;
  livro: { titulo: string };
}

// ---------- Funções auxiliares ----------

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function arred1(n: number): number {
  return Math.round(n * 10) / 10;
}

function arred2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mediaArred1(valores: number[]): number | null {
  const m = media(valores);
  return m === null ? null : arred1(m);
}

function naoNulos(valores: (number | null)[]): number[] {
  return valores.filter((v): v is number => v !== null);
}

// Anos completos na data de hoje. A data de nascimento é gravada como meia-noite UTC, então o dia,
// o mês e o ano dela são lidos em UTC; "hoje" segue o fuso do servidor.
function idadeEm(data: Date): number {
  const hoje = new Date();
  let anos = hoje.getFullYear() - data.getUTCFullYear();
  const antesDoAniversario =
    hoje.getMonth() < data.getUTCMonth() ||
    (hoje.getMonth() === data.getUTCMonth() && hoje.getDate() < data.getUTCDate());
  if (antesDoAniversario) anos -= 1;
  return anos;
}

// Horas entre dois horários "HH:MM".
function horasEntre(inicio: string, fim: string): number {
  const minutos = (hora: string): number => {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  };
  const diferenca = minutos(fim) - minutos(inicio);
  return Number.isNaN(diferenca) ? 0 : diferenca / 60;
}

// Mesma regra do financeiro: ABERTA com vencimento antes do início de hoje vira ATRASADA.
async function marcarAtrasadas(alunoId: number): Promise<void> {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  await prisma.mensalidade.updateMany({
    where: { status: 'ABERTA', vencimento: { lt: inicioHoje }, matricula: { alunoId } },
    data: { status: 'ATRASADA' },
  });
}

// Professor só vê aluno que tenha inscrição (qualquer status) em turma dele.
async function verificarAcessoAluno(alunoId: number, professorId: number | null): Promise<void> {
  const existe = await prisma.aluno.findUnique({ where: { id: alunoId }, select: { id: true } });
  if (!existe) {
    throw new HttpError(404, 'Aluno não encontrado');
  }
  if (professorId === null) {
    throw new HttpError(403, 'Sem permissão para ver este aluno');
  }
  const vinculos = await prisma.inscricao.count({
    where: { matricula: { alunoId }, turma: { professorId } },
  });
  if (vinculos === 0) {
    throw new HttpError(403, 'Sem permissão para ver este aluno');
  }
}

async function carregarMensalidades(alunoId: number): Promise<MensalidadeLinha[]> {
  return prisma.mensalidade.findMany({
    where: { matricula: { alunoId } },
    orderBy: { vencimento: 'desc' },
    select: { id: true, competencia: true, vencimento: true, valor: true, desconto: true, status: true },
  });
}

async function carregarEmprestimos(usuarioId: number): Promise<EmprestimoLinha[]> {
  return prisma.emprestimo.findMany({
    where: { usuarioId },
    orderBy: { retiradoEm: 'desc' },
    take: 5,
    select: {
      id: true,
      retiradoEm: true,
      devolucaoPrevista: true,
      devolvidoEm: true,
      status: true,
      livro: { select: { titulo: true } },
    },
  });
}

function formatarEmprestimos(lista: EmprestimoLinha[], agora: Date) {
  return lista.map((e) => ({
    id: e.id,
    livro: e.livro.titulo,
    retiradoEm: e.retiradoEm.toISOString(),
    devolucaoPrevista: e.devolucaoPrevista.toISOString(),
    devolvidoEm: e.devolvidoEm ? e.devolvidoEm.toISOString() : null,
    atrasado: e.status === 'ATIVO' && e.devolucaoPrevista.getTime() < agora.getTime(),
  }));
}

// ---------- Ficha do aluno ----------

async function carregarAluno(id: number) {
  return prisma.aluno.findUnique({
    where: { id },
    select: {
      id: true,
      ra: true,
      dataNascimento: true,
      endereco: true,
      responsavelNome: true,
      responsavelTelefone: true,
      responsavelEmail: true,
      usuarioId: true,
      usuario: {
        select: { nome: true, email: true, cpf: true, telefone: true, ativo: true, criadoEm: true },
      },
      matriculas: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          status: true,
          serieAtual: true,
          dataMatricula: true,
          curso: { select: { id: true, nome: true, nivel: true, regime: true } },
          periodoIngresso: { select: { nome: true } },
          inscricoes: {
            select: {
              id: true,
              status: true,
              notaFinal: true,
              frequencia: true,
              turma: {
                select: {
                  codigo: true,
                  disciplina: { select: { nome: true, codigo: true } },
                  periodoLetivo: { select: { nome: true, inicio: true } },
                  professor: { select: { usuario: { select: { nome: true } } } },
                },
              },
            },
          },
          projeto: {
            select: {
              id: true,
              titulo: true,
              status: true,
              orientador: { select: { usuario: { select: { nome: true } } } },
            },
          },
        },
      },
    },
  });
}

router.get(
  '/alunos/:id/ficha',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const u = req.usuario;
    const ehProfessor = u.perfil === 'PROFESSOR';

    if (ehProfessor) {
      await verificarAcessoAluno(id, u.professorId);
    } else {
      await marcarAtrasadas(id);
    }

    const aluno = await carregarAluno(id);
    if (!aluno) {
      throw new HttpError(404, 'Aluno não encontrado');
    }

    const agora = new Date();
    const [mensalidades, emprestimos, emprestimosAtivos] = await Promise.all([
      ehProfessor ? Promise.resolve<MensalidadeLinha[]>([]) : carregarMensalidades(id),
      carregarEmprestimos(aluno.usuarioId),
      prisma.emprestimo.count({ where: { usuarioId: aluno.usuarioId, status: 'ATIVO' } }),
    ]);

    // Disciplinas: todas as inscrições, da mais recente para a mais antiga.
    const inscricoes = aluno.matriculas.flatMap((m) => m.inscricoes);
    const disciplinas = [...inscricoes]
      .sort(
        (a, b) =>
          b.turma.periodoLetivo.inicio.getTime() - a.turma.periodoLetivo.inicio.getTime() ||
          b.id - a.id
      )
      .map((i) => ({
        inscricaoId: i.id,
        disciplina: i.turma.disciplina.nome,
        codigo: i.turma.disciplina.codigo,
        turma: i.turma.codigo,
        periodo: i.turma.periodoLetivo.nome,
        professor: i.turma.professor.usuario.nome,
        status: i.status,
        notaFinal: i.notaFinal,
        frequencia: i.frequencia,
      }));

    // Financeiro: indicadores sobre todas as mensalidades; lista com as 6 mais recentes.
    const emAberto = mensalidades.filter((m) => m.status === 'ABERTA' || m.status === 'ATRASADA');
    const somaEmAberto = emAberto.reduce((soma, m) => soma + (m.valor - m.desconto), 0);

    const mensalidadesLista = mensalidades.slice(0, 6).map((m) => ({
      id: m.id,
      competencia: m.competencia,
      vencimento: m.vencimento.toISOString(),
      valorFinal: arred2(m.valor - m.desconto),
      status: m.status,
    }));

    // Projeto: o primeiro das matrículas (ordenadas por id).
    const projetoMatricula = aluno.matriculas.find((m) => m.projeto !== null)?.projeto ?? null;
    const projeto = projetoMatricula
      ? {
          id: projetoMatricula.id,
          titulo: projetoMatricula.titulo,
          status: projetoMatricula.status,
          orientador: projetoMatricula.orientador.usuario.nome,
        }
      : null;

    res.json({
      aluno: {
        id: aluno.id,
        ra: aluno.ra,
        nome: aluno.usuario.nome,
        email: aluno.usuario.email,
        cpf: ehProfessor ? null : aluno.usuario.cpf,
        telefone: aluno.usuario.telefone,
        ativo: aluno.usuario.ativo,
        dataNascimento: aluno.dataNascimento.toISOString(),
        idade: idadeEm(aluno.dataNascimento),
        endereco: ehProfessor ? null : aluno.endereco,
        responsavelNome: aluno.responsavelNome,
        responsavelTelefone: ehProfessor ? null : aluno.responsavelTelefone,
        responsavelEmail: ehProfessor ? null : aluno.responsavelEmail,
        usuarioId: aluno.usuarioId,
        criadoEm: aluno.usuario.criadoEm.toISOString(),
      },
      indicadores: {
        disciplinasCursando: inscricoes.filter((i) => i.status === 'CURSANDO').length,
        mediaGeral: mediaArred1(naoNulos(inscricoes.map((i) => i.notaFinal))),
        frequenciaMedia: mediaArred1(naoNulos(inscricoes.map((i) => i.frequencia))),
        mensalidadesEmAberto: emAberto.length,
        valorEmAberto: arred2(somaEmAberto),
        emprestimosAtivos,
      },
      matriculas: aluno.matriculas.map((m) => ({
        id: m.id,
        status: m.status,
        serieAtual: m.serieAtual,
        dataMatricula: m.dataMatricula.toISOString(),
        curso: { id: m.curso.id, nome: m.curso.nome, nivel: m.curso.nivel, regime: m.curso.regime },
        periodoIngresso: m.periodoIngresso.nome,
      })),
      disciplinas,
      mensalidades: mensalidadesLista,
      emprestimos: formatarEmprestimos(emprestimos, agora),
      projeto,
    });
  })
);

// ---------- Ficha do professor (ADMIN, SECRETARIA) ----------

router.get(
  '/professores/:id/ficha',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const professor = await prisma.professor.findUnique({
      where: { id },
      select: {
        id: true,
        registro: true,
        titulacao: true,
        area: true,
        usuarioId: true,
        usuario: {
          select: { nome: true, email: true, cpf: true, telefone: true, ativo: true, criadoEm: true },
        },
      },
    });
    if (!professor) {
      throw new HttpError(404, 'Professor não encontrado');
    }

    const [turmas, projetos, membros, emprestimos] = await Promise.all([
      prisma.turma.findMany({
        where: { professorId: id },
        select: {
          id: true,
          codigo: true,
          grupo: true,
          sala: true,
          vagas: true,
          disciplina: { select: { nome: true, curso: { select: { nome: true } } } },
          periodoLetivo: { select: { nome: true, ativo: true } },
          inscricoes: { select: { status: true, notaFinal: true, frequencia: true } },
          horarios: { select: { diaSemana: true, horaInicio: true, horaFim: true, sala: true } },
        },
      }),
      prisma.projetoPesquisa.findMany({
        where: { OR: [{ orientadorId: id }, { coorientadorId: id }] },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          titulo: true,
          status: true,
          orientadorId: true,
          matricula: {
            select: {
              aluno: { select: { usuario: { select: { nome: true } } } },
              curso: { select: { nome: true } },
            },
          },
        },
      }),
      prisma.bancaMembro.findMany({
        where: { professorId: id },
        orderBy: { banca: { data: 'desc' } },
        select: {
          papel: true,
          banca: {
            select: {
              id: true,
              tipo: true,
              data: true,
              resultado: true,
              projeto: { select: { titulo: true } },
            },
          },
        },
      }),
      carregarEmprestimos(professor.usuarioId),
    ]);

    const agora = new Date();
    const ativas = turmas.filter((t) => t.periodoLetivo.ativo);
    const inscricoesAtivas = ativas.flatMap((t) => t.inscricoes);

    const turmasLista = [...turmas]
      .sort(
        (a, b) =>
          Number(b.periodoLetivo.ativo) - Number(a.periodoLetivo.ativo) ||
          a.codigo.localeCompare(b.codigo, 'pt-BR')
      )
      .map((t) => ({
        id: t.id,
        codigo: t.codigo,
        disciplina: t.disciplina.nome,
        curso: t.disciplina.curso.nome,
        periodo: t.periodoLetivo.nome,
        periodoAtivo: t.periodoLetivo.ativo,
        grupo: t.grupo,
        sala: t.sala,
        inscritos: t.inscricoes.filter((i) => i.status !== 'TRANCADO').length,
        vagas: t.vagas,
      }));

    const horarios = ativas
      .flatMap((t) =>
        t.horarios.map((h) => ({
          diaSemana: h.diaSemana,
          horaInicio: h.horaInicio,
          horaFim: h.horaFim,
          sala: h.sala,
          turma: t.codigo,
          disciplina: t.disciplina.nome,
        }))
      )
      .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio));

    const cargaSemanal = ativas
      .flatMap((t) => t.horarios)
      .reduce((soma, h) => soma + horasEntre(h.horaInicio, h.horaFim), 0);

    const orientacoes = projetos.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      status: p.status,
      aluno: p.matricula.aluno.usuario.nome,
      curso: p.matricula.curso.nome,
      papel: p.orientadorId === id ? ('Orientador' as const) : ('Coorientador' as const),
    }));

    const bancas = membros.map((m) => ({
      id: m.banca.id,
      tipo: m.banca.tipo,
      data: m.banca.data.toISOString(),
      resultado: m.banca.resultado,
      papel: m.papel,
      projeto: m.banca.projeto.titulo,
    }));

    const usuario = professor.usuario;
    res.json({
      professor: {
        id: professor.id,
        registro: professor.registro,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
        telefone: usuario.telefone,
        ativo: usuario.ativo,
        titulacao: professor.titulacao,
        area: professor.area,
        usuarioId: professor.usuarioId,
        criadoEm: usuario.criadoEm.toISOString(),
      },
      indicadores: {
        turmasAtivas: ativas.length,
        alunos: inscricoesAtivas.filter((i) => i.status === 'CURSANDO').length,
        orientacoes: orientacoes.length,
        frequenciaMedia: mediaArred1(naoNulos(inscricoesAtivas.map((i) => i.frequencia))),
        mediaDasTurmas: mediaArred1(naoNulos(inscricoesAtivas.map((i) => i.notaFinal))),
        cargaSemanalHoras: arred1(cargaSemanal),
      },
      turmas: turmasLista,
      horarios,
      orientacoes,
      bancas,
      emprestimos: formatarEmprestimos(emprestimos, agora),
    });
  })
);

export default router;
