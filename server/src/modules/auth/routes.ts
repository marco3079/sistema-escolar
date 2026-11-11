import { Request, Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, validar } from '../../lib/erros';
import { gerarToken, UsuarioToken } from '../../lib/auth';
import { registrarLog } from '../../lib/log';

// Rotas públicas (montadas antes de qualquer autenticação)
export const publico = Router();

// Rotas autenticadas (montadas com `autenticar`)
const router = Router();

const SEM_PRIVILEGIO = 'Sem permissão';

// Limite de tentativas de login (em memória): chave "ip|e-mail em minúsculas" -> instantes das falhas.
const FALHAS_JANELA_MS = 10 * 60 * 1000;
const FALHAS_LIMITE = 10;
const LIMITE_CHAVES_FALHAS = 2000;
const falhasLogin = new Map<string, number[]>();

function falhasRecentes(chave: string, agora: number): number[] {
  return (falhasLogin.get(chave) ?? []).filter((instante) => agora - instante < FALHAS_JANELA_MS);
}

function limparFalhasVencidas(): void {
  const agora = Date.now();
  for (const [chave] of falhasLogin) {
    const recentes = falhasRecentes(chave, agora);
    if (recentes.length === 0) {
      falhasLogin.delete(chave);
    } else {
      falhasLogin.set(chave, recentes);
    }
  }
}

setInterval(limparFalhasVencidas, FALHAS_JANELA_MS).unref();

// IP e navegador da requisição, para o registro de atividades.
function contextoRequisicao(req: Request): { ip: string | null; navegador: string | null } {
  const navegador = req.get('user-agent');
  return {
    ip: req.ip ?? null,
    navegador: navegador ? navegador.slice(0, 200) : null,
  };
}

function paraUsuarioResposta(u: {
  id: number;
  nome: string;
  email: string;
  perfil: UsuarioToken['perfil'];
  aluno: { id: number } | null;
  professor: { id: number } | null;
}) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    alunoId: u.aluno ? u.aluno.id : null,
    professorId: u.professor ? u.professor.id : null,
  };
}

publico.get('/saude', (_req, res) => {
  res.json({ ok: true });
});

const loginSchema = z.object({
  email: z.string().min(1),
  senha: z.string().min(1),
});

publico.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const { email, senha } = validar(loginSchema, req.body);
    const contexto = contextoRequisicao(req);
    const chave = (req.ip ?? '') + '|' + email.toLowerCase();
    const agora = Date.now();
    const falhaLogin = (status: number, mensagem: string): HttpError => {
      // A senha nunca entra no registro; só o e-mail informado (cortado em 120 caracteres).
      registrarLog({
        usuarioId: null,
        tipo: 'FALHA_LOGIN',
        modulo: 'Sessão',
        descricao: 'Tentativa de login sem sucesso: ' + email.slice(0, 120),
        metodo: 'POST',
        caminho: '/api/auth/login',
        status,
        ip: contexto.ip,
        navegador: contexto.navegador,
      });
      return new HttpError(status, mensagem);
    };
    const recentes = falhasRecentes(chave, agora);
    if (recentes.length >= FALHAS_LIMITE) {
      throw falhaLogin(429, 'Muitas tentativas. Aguarde alguns minutos.');
    }
    const registrarFalhaNoLimite = (): void => {
      if (falhasLogin.size >= LIMITE_CHAVES_FALHAS) {
        limparFalhasVencidas();
      }
      falhasLogin.set(chave, [...recentes, agora]);
    };
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { aluno: true, professor: true },
    });
    if (!usuario || !usuario.ativo) {
      registrarFalhaNoLimite();
      throw falhaLogin(401, 'E-mail ou senha inválidos');
    }
    const confere = await bcrypt.compare(senha, usuario.senhaHash);
    if (!confere) {
      registrarFalhaNoLimite();
      throw falhaLogin(401, 'E-mail ou senha inválidos');
    }
    falhasLogin.delete(chave);
    const dados = paraUsuarioResposta(usuario);
    const token = gerarToken({
      id: dados.id,
      perfil: dados.perfil,
      alunoId: dados.alunoId,
      professorId: dados.professorId,
    });
    registrarLog({
      usuarioId: dados.id,
      usuarioNome: dados.nome,
      perfil: dados.perfil,
      tipo: 'LOGIN',
      modulo: 'Sessão',
      descricao: 'Entrou no sistema',
      metodo: 'POST',
      caminho: '/api/auth/login',
      status: 200,
      ip: contexto.ip,
      navegador: contexto.navegador,
    });
    res.json({ token, usuario: dados });
  })
);

router.post(
  '/auth/sair',
  (req, res) => {
    registrarLog({
      usuarioId: req.usuario.id,
      perfil: req.usuario.perfilReal ?? req.usuario.perfil,
      tipo: 'SAIDA',
      modulo: 'Sessão',
      descricao: 'Saiu do sistema',
      metodo: 'POST',
      caminho: '/api/auth/sair',
      status: 204,
      ...contextoRequisicao(req),
    });
    res.status(204).end();
  }
);

router.get(
  '/auth/me',
  asyncHandler(async (req, res) => {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      include: { aluno: true, professor: true },
    });
    if (!usuario) {
      throw new HttpError(401, 'Não autenticado');
    }
    res.json(paraUsuarioResposta(usuario));
  })
);

const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(6),
});

router.post(
  '/auth/trocar-senha',
  asyncHandler(async (req, res) => {
    const { senhaAtual, novaSenha } = validar(trocarSenhaSchema, req.body);
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) {
      throw new HttpError(401, 'Não autenticado');
    }
    const confere = await bcrypt.compare(senhaAtual, usuario.senhaHash);
    if (!confere) {
      throw new HttpError(400, 'Senha atual incorreta');
    }
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });
    res.status(204).end();
  })
);

router.get(
  '/painel',
  asyncHandler(async (req, res) => {
    const { perfil, id, alunoId, professorId } = req.usuario;
    const cartoes: { rotulo: string; valor: string | number }[] = [];

    if (perfil === 'ADMIN' || perfil === 'SECRETARIA') {
      const [alunos, professores, cursos, turmas, mensalidades] = await Promise.all([
        prisma.aluno.count({ where: { usuario: { ativo: true } } }),
        prisma.professor.count(),
        prisma.curso.count({ where: { ativo: true } }),
        prisma.turma.count({ where: { periodoLetivo: { ativo: true } } }),
        prisma.mensalidade.count({ where: { status: { in: ['ABERTA', 'ATRASADA'] } } }),
      ]);
      cartoes.push(
        { rotulo: 'Alunos ativos', valor: alunos },
        { rotulo: 'Professores', valor: professores },
        { rotulo: 'Cursos ativos', valor: cursos },
        { rotulo: 'Turmas em períodos ativos', valor: turmas },
        { rotulo: 'Mensalidades em aberto', valor: mensalidades }
      );
    } else if (perfil === 'PROFESSOR') {
      if (professorId === null) {
        throw new HttpError(403, SEM_PRIVILEGIO);
      }
      const [minhasTurmas, meusAlunos, orientacoes] = await Promise.all([
        prisma.turma.count({
          where: { professorId, periodoLetivo: { ativo: true } },
        }),
        prisma.inscricao.count({
          where: {
            status: 'CURSANDO',
            turma: { professorId, periodoLetivo: { ativo: true } },
          },
        }),
        prisma.projetoPesquisa.count({
          where: { OR: [{ orientadorId: professorId }, { coorientadorId: professorId }] },
        }),
      ]);
      cartoes.push(
        { rotulo: 'Minhas turmas (períodos ativos)', valor: minhasTurmas },
        { rotulo: 'Meus alunos (cursando)', valor: meusAlunos },
        { rotulo: 'Orientações', valor: orientacoes }
      );
    } else if (perfil === 'ALUNO') {
      if (alunoId === null) {
        throw new HttpError(403, SEM_PRIVILEGIO);
      }
      const [disciplinas, mensalidades, emprestimos, comunicados] = await Promise.all([
        prisma.inscricao.count({
          where: { status: 'CURSANDO', matricula: { alunoId } },
        }),
        prisma.mensalidade.count({
          where: {
            status: { in: ['ABERTA', 'ATRASADA'] },
            matricula: { alunoId },
          },
        }),
        prisma.emprestimo.count({
          where: { usuarioId: id, status: 'ATIVO' },
        }),
        prisma.comunicado.count({
          where: {
            publico: { in: ['TODOS', 'ALUNOS'] },
            leituras: { none: { usuarioId: id } },
          },
        }),
      ]);
      cartoes.push(
        { rotulo: 'Disciplinas cursando', valor: disciplinas },
        { rotulo: 'Mensalidades em aberto', valor: mensalidades },
        { rotulo: 'Empréstimos ativos', valor: emprestimos },
        { rotulo: 'Comunicados não lidos', valor: comunicados }
      );
    } else {
      throw new HttpError(403, SEM_PRIVILEGIO);
    }

    res.json({ cartoes });
  })
);

export default router;
