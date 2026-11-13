import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { registrarLog } from '../../lib/log';
import {
  alunoCampos,
  alunoCriarSchema,
  avisarBoasVindas,
  corpoImportacaoSchema,
  criarAluno,
  criarProfessor,
  emailSchema,
  garantirEmailLivre,
  importarPlanilha,
  modeloImportacao,
  professorCampos,
  professorCriarSchema,
  ResultadoImportacao,
  senhaSchema,
  textoOpcional,
  TipoPlanilha,
} from './importacao';

const router = Router();

// ---------- Utilitários ----------

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

async function carregarPerfil(id: number) {
  return prisma.usuario.findUnique({
    where: { id },
    include: { aluno: true, professor: true },
  });
}

// Resposta da importação: 400 com o relatório se houver erro, 201 se gravou, 200 na simulação.
function responderImportacao(
  req: Request,
  res: Response,
  tipo: TipoPlanilha,
  resultado: ResultadoImportacao
): void {
  if (resultado.bloqueada) {
    res.status(400).json({
      erro: 'Há linhas com erro; nenhuma foi importada',
      detalhes: resultado.relatorio,
    });
    return;
  }
  if (resultado.gravou) {
    const quantidade = resultado.relatorio.criadas;
    registrarLog({
      usuarioId: req.usuario.id,
      perfil: req.usuario.perfilReal ?? req.usuario.perfil,
      tipo: 'CRIACAO',
      modulo: tipo === 'alunos' ? 'Alunos' : 'Professores',
      descricao: `Importou ${quantidade} ${tipo} por planilha`,
      metodo: 'POST',
      caminho: `/api/${tipo}/importar`,
      status: 201,
      ip: req.ip ?? null,
      navegador: req.get('user-agent')?.slice(0, 200) ?? null,
    });
    res.status(201).json(resultado.relatorio);
    return;
  }
  res.json(resultado.relatorio);
}

// ---------- Schemas de cadastro (zod) ----------

const usuarioCriarSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  email: emailSchema,
  senha: senhaSchema,
  perfil: z.enum(['ADMIN', 'TI', 'SECRETARIA']),
});

const usuarioAtualizarSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').optional(),
  email: emailSchema.optional(),
  telefone: textoOpcional,
  ativo: z.boolean().optional(),
});

const usuarioFiltroSchema = z.object({
  perfil: z.enum(['ADMIN', 'TI', 'SECRETARIA', 'PROFESSOR', 'ALUNO']).optional(),
  busca: z.string().optional(),
});

const redefinirSenhaSchema = z.object({ novaSenha: senhaSchema });

const alunoAtualizarSchema = z.object(alunoCampos).partial();
const professorAtualizarSchema = z.object(professorCampos).partial();

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
  '/alunos/importar/modelo',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (_req, res) => {
    res.json(modeloImportacao('alunos'));
  })
);

router.post(
  '/alunos/importar',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const corpo = validar(corpoImportacaoSchema, req.body);
    const resultado = await importarPlanilha('alunos', corpo);
    responderImportacao(req, res, 'alunos', resultado);
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
    const aluno = await criarAluno(dados);
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
  '/professores/importar/modelo',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (_req, res) => {
    res.json(modeloImportacao('professores'));
  })
);

router.post(
  '/professores/importar',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const corpo = validar(corpoImportacaoSchema, req.body);
    const resultado = await importarPlanilha('professores', corpo);
    responderImportacao(req, res, 'professores', resultado);
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
    const professor = await criarProfessor(dados);
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
