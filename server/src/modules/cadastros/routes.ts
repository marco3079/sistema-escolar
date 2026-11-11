import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { emailHabilitado, enderecoDoSite, enfileirarEmail, lerConfiguracao } from '../../lib/email';
import { criarTokenSenha } from '../../lib/tokens-senha';

const router = Router();

// ---------- Utilitários ----------

// E-mail de boas-vindas com o botão "Criar minha senha". Roda em segundo plano:
// nunca atrasa nem derruba a resposta do cadastro.
function avisarBoasVindas(usuario: { id: number; nome: string; email: string }): void {
  void (async () => {
    if (!(await emailHabilitado('BOAS_VINDAS'))) {
      return;
    }
    const endereco = await enderecoDoSite();
    if (!endereco) {
      return;
    }
    const { nome: nomePlataforma } = await lerConfiguracao();
    const token = await criarTokenSenha(usuario.id, 'BOAS_VINDAS');
    enfileirarEmail({
      para: usuario.email,
      assunto: `Bem-vindo ao ${nomePlataforma}`,
      titulo: `Bem-vindo ao ${nomePlataforma}`,
      paragrafos: [
        `Criamos a sua conta no ${nomePlataforma}.`,
        `Seu e-mail de acesso é ${usuario.email}.`,
        'Clique no botão abaixo para criar a sua senha. O link vale por 7 dias.',
      ],
      botao: { rotulo: 'Criar minha senha', endereco: `${endereco}/redefinir-senha/${token}` },
      tipo: 'BOAS_VINDAS',
    });
  })().catch(() => undefined);
}

// Remove senhaHash de qualquer registro de usuário antes de responder.
function semSenha<U extends { senhaHash: string }>(usuario: U): Omit<U, 'senhaHash'> {
  const { senhaHash, ...resto } = usuario;
  return resto;
}

// Converte Aluno (ou Professor) com `usuario` incluído no formato AlunoDTO/ProfessorDTO.
function paraDTO<R extends { usuario: { senhaHash: string } }>(registro: R) {
  const { usuario, ...resto } = registro;
  return { ...resto, usuario: semSenha(usuario) };
}

function textoBusca(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

async function garantirEmailLivre(email: string, ignorarUsuarioId?: number): Promise<void> {
  const outro = await prisma.usuario.findFirst({
    where: ignorarUsuarioId === undefined ? { email } : { email, id: { not: ignorarUsuarioId } },
    select: { id: true },
  });
  if (outro) {
    throw new HttpError(409, 'E-mail já cadastrado');
  }
}

// RA: ano atual + sequência de 5 dígitos (ex.: 202600001).
async function proximoRA(tx: Prisma.TransactionClient): Promise<string> {
  const ano = String(new Date().getFullYear());
  const ultimo = await tx.aluno.findFirst({
    where: { ra: { startsWith: ano } },
    orderBy: { ra: 'desc' },
    select: { ra: true },
  });
  const sequencia = ultimo ? Number(ultimo.ra.slice(ano.length)) + 1 : 1;
  return ano + String(sequencia).padStart(5, '0');
}

// Registro do professor: 'P' + 4 dígitos (ex.: P0001).
async function proximoRegistro(tx: Prisma.TransactionClient): Promise<string> {
  const ultimo = await tx.professor.findFirst({
    where: { registro: { startsWith: 'P' } },
    orderBy: { registro: 'desc' },
    select: { registro: true },
  });
  const sequencia = ultimo ? Number(ultimo.registro.slice(1)) + 1 : 1;
  return 'P' + String(sequencia).padStart(4, '0');
}

async function carregarPerfil(id: number) {
  return prisma.usuario.findUnique({
    where: { id },
    include: { aluno: true, professor: true },
  });
}

// ---------- Schemas (zod) ----------

const senhaSchema = z.string().min(6, 'A senha deve ter pelo menos 6 caracteres');
const textoOpcional = z.string().nullable().optional();
const dataSchema = z
  .string()
  .refine((valor) => !Number.isNaN(new Date(valor).getTime()), 'Data inválida');
const titulacaoSchema = z.enum(['GRADUADO', 'ESPECIALISTA', 'MESTRE', 'DOUTOR']);
const perfilUsuarioSchema = z.enum(['ADMIN', 'TI', 'SECRETARIA']);

const alunoCampos = {
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  cpf: textoOpcional,
  telefone: textoOpcional,
  dataNascimento: dataSchema,
  endereco: textoOpcional,
  responsavelNome: textoOpcional,
  responsavelTelefone: textoOpcional,
  responsavelEmail: textoOpcional,
};

const alunoCriarSchema = z.object({ ...alunoCampos, senha: senhaSchema });
const alunoAtualizarSchema = z.object(alunoCampos).partial();

const professorCampos = {
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  cpf: textoOpcional,
  telefone: textoOpcional,
  titulacao: titulacaoSchema,
  area: textoOpcional,
};

const professorCriarSchema = z.object({ ...professorCampos, senha: senhaSchema });
const professorAtualizarSchema = z.object(professorCampos).partial();

const usuarioCriarSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  senha: senhaSchema,
  perfil: perfilUsuarioSchema,
});

const usuarioAtualizarSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').optional(),
  email: z.string().email('E-mail inválido').optional(),
  telefone: textoOpcional,
  ativo: z.boolean().optional(),
});

const usuarioFiltroSchema = z.object({
  perfil: z.enum(['ADMIN', 'TI', 'SECRETARIA', 'PROFESSOR', 'ALUNO']).optional(),
  busca: z.string().optional(),
});

const redefinirSenhaSchema = z.object({ novaSenha: senhaSchema });

const perfilAtualizarSchema = z.object({
  telefone: textoOpcional,
  endereco: textoOpcional,
});

// ---------- Usuários (somente ADMIN) ----------

router.get(
  '/usuarios',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const filtro = validar(usuarioFiltroSchema, req.query);
    const busca = textoBusca(filtro.busca);
    const usuarios = await prisma.usuario.findMany({
      where: {
        perfil: filtro.perfil,
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: 'insensitive' } },
                { email: { contains: busca, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { nome: 'asc' },
    });
    res.json(usuarios.map((u) => semSenha(u)));
  })
);

router.post(
  '/usuarios',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const dados = validar(usuarioCriarSchema, req.body);
    await garantirEmailLivre(dados.email);
    const senhaHash = await bcrypt.hash(dados.senha, 10);
    const usuario = await prisma.usuario.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        senhaHash,
        perfil: dados.perfil,
      },
    });
    avisarBoasVindas(usuario);
    res.status(201).json(semSenha(usuario));
  })
);

router.put(
  '/usuarios/:id',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(usuarioAtualizarSchema, req.body);
    const existente = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    if (dados.email !== undefined) {
      await garantirEmailLivre(dados.email, id);
    }
    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        ativo: dados.ativo,
      },
    });
    res.json(semSenha(usuario));
  })
);

router.post(
  '/usuarios/:id/redefinir-senha',
  permitir('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const { novaSenha } = validar(redefinirSenhaSchema, req.body);
    const existente = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await prisma.usuario.update({ where: { id }, data: { senhaHash } });
    res.status(204).end();
  })
);

// ---------- Alunos ----------

const incluiAluno = { usuario: true } as const;

router.get(
  '/alunos',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const busca = textoBusca(req.query.busca);
    const alunos = await prisma.aluno.findMany({
      where: busca
        ? {
            OR: [
              { ra: { contains: busca, mode: 'insensitive' } },
              { usuario: { nome: { contains: busca, mode: 'insensitive' } } },
              { usuario: { email: { contains: busca, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: incluiAluno,
      orderBy: { usuario: { nome: 'asc' } },
    });
    res.json(alunos.map((a) => paraDTO(a)));
  })
);

router.get(
  '/alunos/:id',
  permitir('ADMIN', 'SECRETARIA', 'PROFESSOR'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const aluno = await prisma.aluno.findUnique({
      where: { id },
      include: {
        usuario: true,
        matriculas: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            status: true,
            serieAtual: true,
            curso: { select: { id: true, nome: true, nivel: true } },
          },
        },
      },
    });
    if (!aluno) {
      throw new HttpError(404, 'Aluno não encontrado');
    }
    res.json(paraDTO(aluno));
  })
);

router.post(
  '/alunos',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(alunoCriarSchema, req.body);
    await garantirEmailLivre(dados.email);
    const senhaHash = await bcrypt.hash(dados.senha, 10);
    const aluno = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senhaHash,
          perfil: 'ALUNO',
          cpf: dados.cpf ?? null,
          telefone: dados.telefone ?? null,
        },
      });
      const ra = await proximoRA(tx);
      return tx.aluno.create({
        data: {
          usuarioId: usuario.id,
          ra,
          dataNascimento: new Date(dados.dataNascimento),
          endereco: dados.endereco ?? null,
          responsavelNome: dados.responsavelNome ?? null,
          responsavelTelefone: dados.responsavelTelefone ?? null,
          responsavelEmail: dados.responsavelEmail ?? null,
        },
        include: incluiAluno,
      });
    });
    avisarBoasVindas(aluno.usuario);
    res.status(201).json(paraDTO(aluno));
  })
);

router.put(
  '/alunos/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(alunoAtualizarSchema, req.body);
    const atual = await prisma.aluno.findUnique({ where: { id }, select: { usuarioId: true } });
    if (!atual) {
      throw new HttpError(404, 'Aluno não encontrado');
    }
    if (dados.email !== undefined) {
      await garantirEmailLivre(dados.email, atual.usuarioId);
    }
    const aluno = await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: atual.usuarioId },
        data: {
          nome: dados.nome,
          email: dados.email,
          cpf: dados.cpf,
          telefone: dados.telefone,
        },
      });
      return tx.aluno.update({
        where: { id },
        data: {
          dataNascimento:
            dados.dataNascimento !== undefined ? new Date(dados.dataNascimento) : undefined,
          endereco: dados.endereco,
          responsavelNome: dados.responsavelNome,
          responsavelTelefone: dados.responsavelTelefone,
          responsavelEmail: dados.responsavelEmail,
        },
        include: incluiAluno,
      });
    });
    res.json(paraDTO(aluno));
  })
);

router.delete(
  '/alunos/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await prisma.aluno.findUnique({ where: { id }, select: { usuarioId: true } });
    if (!atual) {
      throw new HttpError(404, 'Aluno não encontrado');
    }
    await prisma.usuario.update({ where: { id: atual.usuarioId }, data: { ativo: false } });
    res.status(204).end();
  })
);

// ---------- Professores ----------

const incluiProfessor = { usuario: true } as const;

router.get(
  '/professores',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const busca = textoBusca(req.query.busca);
    const professores = await prisma.professor.findMany({
      where: busca
        ? {
            OR: [
              { registro: { contains: busca, mode: 'insensitive' } },
              { usuario: { nome: { contains: busca, mode: 'insensitive' } } },
              { usuario: { email: { contains: busca, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: incluiProfessor,
      orderBy: { usuario: { nome: 'asc' } },
    });
    res.json(professores.map((p) => paraDTO(p)));
  })
);

router.get(
  '/professores/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const professor = await prisma.professor.findUnique({
      where: { id },
      include: incluiProfessor,
    });
    if (!professor) {
      throw new HttpError(404, 'Professor não encontrado');
    }
    res.json(paraDTO(professor));
  })
);

router.post(
  '/professores',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const dados = validar(professorCriarSchema, req.body);
    await garantirEmailLivre(dados.email);
    const senhaHash = await bcrypt.hash(dados.senha, 10);
    const professor = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senhaHash,
          perfil: 'PROFESSOR',
          cpf: dados.cpf ?? null,
          telefone: dados.telefone ?? null,
        },
      });
      const registro = await proximoRegistro(tx);
      return tx.professor.create({
        data: {
          usuarioId: usuario.id,
          registro,
          titulacao: dados.titulacao,
          area: dados.area ?? null,
        },
        include: incluiProfessor,
      });
    });
    avisarBoasVindas(professor.usuario);
    res.status(201).json(paraDTO(professor));
  })
);

router.put(
  '/professores/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const dados = validar(professorAtualizarSchema, req.body);
    const atual = await prisma.professor.findUnique({ where: { id }, select: { usuarioId: true } });
    if (!atual) {
      throw new HttpError(404, 'Professor não encontrado');
    }
    if (dados.email !== undefined) {
      await garantirEmailLivre(dados.email, atual.usuarioId);
    }
    const professor = await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: atual.usuarioId },
        data: {
          nome: dados.nome,
          email: dados.email,
          cpf: dados.cpf,
          telefone: dados.telefone,
        },
      });
      return tx.professor.update({
        where: { id },
        data: {
          titulacao: dados.titulacao,
          area: dados.area,
        },
        include: incluiProfessor,
      });
    });
    res.json(paraDTO(professor));
  })
);

router.delete(
  '/professores/:id',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const atual = await prisma.professor.findUnique({ where: { id }, select: { usuarioId: true } });
    if (!atual) {
      throw new HttpError(404, 'Professor não encontrado');
    }
    await prisma.usuario.update({ where: { id: atual.usuarioId }, data: { ativo: false } });
    res.status(204).end();
  })
);

// ---------- Meu perfil (qualquer usuário logado) ----------

router.get(
  '/perfil/meu',
  asyncHandler(async (req, res) => {
    const usuario = await carregarPerfil(req.usuario.id);
    if (!usuario) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    res.json(semSenha(usuario));
  })
);

router.put(
  '/perfil/meu',
  asyncHandler(async (req, res) => {
    const dados = validar(perfilAtualizarSchema, req.body);
    const atual = await carregarPerfil(req.usuario.id);
    if (!atual) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: atual.id },
        data: { telefone: dados.telefone },
      });
      // `endereco` só se aplica a alunos; para os demais é ignorado.
      if (atual.aluno && dados.endereco !== undefined) {
        await tx.aluno.update({
          where: { id: atual.aluno.id },
          data: { endereco: dados.endereco },
        });
      }
    });
    const atualizado = await carregarPerfil(req.usuario.id);
    if (!atualizado) {
      throw new HttpError(404, 'Usuário não encontrado');
    }
    res.json(semSenha(atualizado));
  })
);

export default router;
