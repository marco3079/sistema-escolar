import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/erros';
import { emailHabilitado, enderecoDoSite, enfileirarEmail, lerConfiguracao } from '../../lib/email';
import { criarTokenSenha } from '../../lib/tokens-senha';

// Vínculo de responsáveis com alunos. Contrato A em docs/plano/setima-leva.md.
// Usado pela gestão (rotas em routes.ts) e pela aprovação de matrícula (parte S4).

export interface DadosResponsavel {
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
  parentesco: string;
  financeiro?: boolean;
}

export interface ResultadoVinculo {
  vinculoId: number;
  usuarioId: number;
  usuarioCriado: boolean;
  senhaInicial: string | null;
  conviteEnviado: boolean;
}

const ALFABETO_SENHA = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO_SENHA = 10;

// Senha inicial aleatória (crypto), sem caracteres parecidos entre si.
function senhaAleatoria(): string {
  let senha = '';
  for (let i = 0; i < TAMANHO_SENHA; i++) {
    senha += ALFABETO_SENHA[crypto.randomInt(ALFABETO_SENHA.length)];
  }
  return senha;
}

// Convite "Criar minha senha" para o responsável recém-criado. Devolve false quando não pode ser enviado.
async function enviarConvite(usuario: { id: number; email: string }): Promise<boolean> {
  try {
    if (!(await emailHabilitado('SECRETARIA'))) return false;
    const endereco = await enderecoDoSite();
    if (!endereco) return false;
    const { nome: nomePlataforma } = await lerConfiguracao();
    const token = await criarTokenSenha(usuario.id, 'BOAS_VINDAS');
    enfileirarEmail({
      para: usuario.email,
      assunto: `Conta de responsável no ${nomePlataforma}`,
      titulo: `Conta de responsável no ${nomePlataforma}`,
      paragrafos: [
        `Criamos a sua conta de responsável no ${nomePlataforma}.`,
        `Seu e-mail de acesso é ${usuario.email}.`,
        'Clique no botão abaixo para criar a sua senha. O link vale por 7 dias.',
      ],
      botao: { rotulo: 'Criar minha senha', endereco: `${endereco}/redefinir-senha/${token}` },
      tipo: 'SECRETARIA',
    });
    return true;
  } catch {
    return false;
  }
}

function ehDuplicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}

// Liga um responsável ao aluno. Se já existe usuário com o e-mail (sem diferenciar maiúsculas):
// precisa ser de perfil RESPONSAVEL (senão 409) e ainda não estar ligado ao aluno (senão 409).
// Se não existe, cria o usuário RESPONSAVEL e o vínculo numa transação.
export async function vincularResponsavel(alunoId: number, dados: DadosResponsavel): Promise<ResultadoVinculo> {
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId }, select: { id: true } });
  if (!aluno) throw new HttpError(404, 'Aluno não encontrado');

  const email = dados.email.trim().toLowerCase();
  const nome = dados.nome.trim();
  const parentesco = dados.parentesco.trim();
  const financeiro = dados.financeiro ?? true;
  const telefone = dados.telefone?.trim() || null;
  const cpf = dados.cpf?.trim() || null;

  const existente = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, perfil: true },
  });

  if (existente) {
    if (existente.perfil !== 'RESPONSAVEL') {
      throw new HttpError(409, 'Este e-mail já pertence a um usuário de outro perfil');
    }
    const ligado = await prisma.responsavelAluno.findUnique({
      where: { usuarioId_alunoId: { usuarioId: existente.id, alunoId } },
      select: { id: true },
    });
    if (ligado) {
      throw new HttpError(409, 'Este responsável já está ligado a este aluno');
    }
    try {
      const vinculo = await prisma.responsavelAluno.create({
        data: { usuarioId: existente.id, alunoId, parentesco, financeiro },
        select: { id: true },
      });
      return {
        vinculoId: vinculo.id,
        usuarioId: existente.id,
        usuarioCriado: false,
        senhaInicial: null,
        conviteEnviado: false,
      };
    } catch (erro) {
      if (ehDuplicidade(erro)) throw new HttpError(409, 'Este responsável já está ligado a este aluno');
      throw erro;
    }
  }

  const senha = senhaAleatoria();
  const senhaHash = await bcrypt.hash(senha, 10);

  let criado: { usuarioId: number; vinculoId: number; email: string };
  try {
    criado = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: { nome, email, senhaHash, perfil: 'RESPONSAVEL', cpf, telefone },
        select: { id: true, email: true },
      });
      const vinculo = await tx.responsavelAluno.create({
        data: { usuarioId: usuario.id, alunoId, parentesco, financeiro },
        select: { id: true },
      });
      return { usuarioId: usuario.id, vinculoId: vinculo.id, email: usuario.email };
    });
  } catch (erro) {
    if (ehDuplicidade(erro)) throw new HttpError(409, 'E-mail já cadastrado');
    throw erro;
  }

  const conviteEnviado = await enviarConvite({ id: criado.usuarioId, email: criado.email });

  return {
    vinculoId: criado.vinculoId,
    usuarioId: criado.usuarioId,
    usuarioCriado: true,
    senhaInicial: conviteEnviado ? null : senha,
    conviteEnviado,
  };
}
