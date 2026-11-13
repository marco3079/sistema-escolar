import type { Request } from 'express';
import { prisma } from './prisma';
import { HttpError } from './erros';

// Vínculo entre responsáveis (usuários de perfil RESPONSAVEL) e alunos. Contrato A em docs/plano/setima-leva.md.

const SEM_PERMISSAO = 'Sem permissão';

export interface VinculoResponsavel {
  id: number;
  alunoId: number;
  parentesco: string;
  financeiro: boolean;
}

// Vínculos do usuário responsável (vazio para quem não é responsável).
export async function vinculosDoResponsavel(usuarioId: number): Promise<VinculoResponsavel[]> {
  return prisma.responsavelAluno.findMany({
    where: { usuarioId },
    select: { id: true, alunoId: true, parentesco: true, financeiro: true },
    orderBy: { id: 'asc' },
  });
}

// Ids dos alunos sob responsabilidade do usuário.
export async function alunosDoResponsavel(usuarioId: number): Promise<number[]> {
  return (await vinculosDoResponsavel(usuarioId)).map((v) => v.alunoId);
}

// Ids de usuário dos responsáveis do aluno (para avisos). Só usuários ativos.
export async function usuariosResponsaveisDoAluno(alunoId: number): Promise<number[]> {
  const vinculos = await prisma.responsavelAluno.findMany({
    where: { alunoId, usuario: { ativo: true } },
    select: { usuarioId: true },
  });
  return [...new Set(vinculos.map((v) => v.usuarioId))];
}

export type PapelSobreAluno = 'GESTAO' | 'PROPRIO' | 'RESPONSAVEL';

export interface AcessoAluno {
  papel: PapelSobreAluno;
  financeiro: boolean; // pode ver as mensalidades
}

// Confere se quem está logado pode ver os dados do aluno:
// - ADMIN (inclui TI) e SECRETARIA: sempre (papel GESTAO);
// - o próprio aluno (papel PROPRIO);
// - responsável com vínculo (papel RESPONSAVEL; `financeiro` vem do vínculo).
// Qualquer outro caso (inclusive professor): HttpError 403. Não confere se o aluno existe.
export async function acessoAoAluno(req: Request, alunoId: number): Promise<AcessoAluno> {
  const { id, perfil, alunoId: alunoLogado } = req.usuario;
  if (perfil === 'ADMIN' || perfil === 'SECRETARIA') return { papel: 'GESTAO', financeiro: true };
  if (perfil === 'ALUNO' && alunoLogado !== null && alunoLogado === alunoId) {
    return { papel: 'PROPRIO', financeiro: true };
  }
  if (perfil === 'RESPONSAVEL') {
    const vinculo = await prisma.responsavelAluno.findUnique({
      where: { usuarioId_alunoId: { usuarioId: id, alunoId } },
      select: { financeiro: true },
    });
    if (vinculo) return { papel: 'RESPONSAVEL', financeiro: vinculo.financeiro };
  }
  throw new HttpError(403, SEM_PERMISSAO);
}

// Igual a acessoAoAluno, a partir de uma matrícula. Matrícula inexistente: 404. Devolve também o alunoId.
export async function acessoAMatricula(
  req: Request,
  matriculaId: number
): Promise<AcessoAluno & { alunoId: number }> {
  const matricula = await prisma.matricula.findUnique({
    where: { id: matriculaId },
    select: { alunoId: true },
  });
  if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');
  const acesso = await acessoAoAluno(req, matricula.alunoId);
  return { ...acesso, alunoId: matricula.alunoId };
}
