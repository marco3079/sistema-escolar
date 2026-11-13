import type { Request } from 'express';
import { prisma } from './prisma';
import { HttpError } from './erros';

// Papel de quem está pedindo dentro de uma turma (sala de aula: materiais, tarefas, provas, plano, chamada).
// - PROFESSOR: o professor da turma. Cria, edita e corrige.
// - GESTAO: administrador, TI e secretaria. Leem tudo; o administrador (e TI) também pode editar.
// - ALUNO: aluno com inscrição na turma que não esteja trancada.
export type PapelNaTurma = 'PROFESSOR' | 'GESTAO' | 'ALUNO';

export interface AcessoTurma {
  papel: PapelNaTurma;
  podeEditar: boolean; // professor da turma ou administrador
  turma: {
    id: number;
    codigo: string;
    professorId: number;
    disciplina: { id: number; nome: string; codigo: string };
    periodoLetivo: { id: number; nome: string };
  };
  inscricaoId: number | null; // só para ALUNO
  matriculaId: number | null; // só para ALUNO
}

const SEM_PERMISSAO = 'Sem permissão';

// Confere o acesso de quem está logado à turma. Turma inexistente: 404. Sem vínculo com a turma: 403.
export async function acessoTurma(req: Request, turmaId: number): Promise<AcessoTurma> {
  const turma = await prisma.turma.findUnique({
    where: { id: turmaId },
    select: {
      id: true,
      codigo: true,
      professorId: true,
      disciplina: { select: { id: true, nome: true, codigo: true } },
      periodoLetivo: { select: { id: true, nome: true } },
    },
  });
  if (!turma) throw new HttpError(404, 'Turma não encontrada');

  const { perfil, professorId, alunoId } = req.usuario;

  if (perfil === 'ADMIN') {
    return { papel: 'GESTAO', podeEditar: true, turma, inscricaoId: null, matriculaId: null };
  }
  if (perfil === 'SECRETARIA') {
    return { papel: 'GESTAO', podeEditar: false, turma, inscricaoId: null, matriculaId: null };
  }
  if (perfil === 'PROFESSOR') {
    if (professorId !== null && turma.professorId === professorId) {
      return { papel: 'PROFESSOR', podeEditar: true, turma, inscricaoId: null, matriculaId: null };
    }
    throw new HttpError(403, SEM_PERMISSAO);
  }
  if (perfil === 'ALUNO' && alunoId !== null) {
    const inscricao = await prisma.inscricao.findFirst({
      where: { turmaId, status: { not: 'TRANCADO' }, matricula: { alunoId } },
      select: { id: true, matriculaId: true },
    });
    if (inscricao) {
      return {
        papel: 'ALUNO',
        podeEditar: false,
        turma,
        inscricaoId: inscricao.id,
        matriculaId: inscricao.matriculaId,
      };
    }
  }
  throw new HttpError(403, SEM_PERMISSAO);
}

// Igual a acessoTurma, mas exige quem pode editar (professor da turma ou administrador).
export async function acessoDeEdicao(req: Request, turmaId: number): Promise<AcessoTurma> {
  const acesso = await acessoTurma(req, turmaId);
  if (!acesso.podeEditar) throw new HttpError(403, SEM_PERMISSAO);
  return acesso;
}

// Igual a acessoTurma, mas exige o aluno inscrito.
export async function acessoDeAluno(
  req: Request,
  turmaId: number
): Promise<AcessoTurma & { inscricaoId: number; matriculaId: number }> {
  const acesso = await acessoTurma(req, turmaId);
  if (acesso.papel !== 'ALUNO' || acesso.inscricaoId === null || acesso.matriculaId === null) {
    throw new HttpError(403, SEM_PERMISSAO);
  }
  return { ...acesso, inscricaoId: acesso.inscricaoId, matriculaId: acesso.matriculaId };
}

// Ids de usuário dos alunos da turma (inscrição não trancada), para avisos.
export async function usuariosDosAlunosDaTurma(turmaId: number): Promise<number[]> {
  const inscricoes = await prisma.inscricao.findMany({
    where: { turmaId, status: { not: 'TRANCADO' } },
    select: { matricula: { select: { aluno: { select: { usuarioId: true } } } } },
  });
  return [...new Set(inscricoes.map((i) => i.matricula.aluno.usuarioId))];
}
