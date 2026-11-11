import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Perfil } from '@prisma/client';

export interface UsuarioToken {
  id: number;
  perfil: Perfil; // efetivo: nunca 'TI' depois de `autenticar` (TI vira 'ADMIN')
  perfilReal?: Perfil; // preenchido por `autenticar` com o perfil verdadeiro
  alunoId: number | null;
  professorId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      usuario: UsuarioToken;
    }
  }
}

const SEGREDO_DE_EXEMPLO = 'troque-este-segredo-de-exemplo';
const SEGREDO_ANTIGO_PADRAO = 'dev-secret';

// Calculado uma vez na subida. Se o segredo estiver ausente ou for de exemplo
// (valores conhecidos do repositório público), gera um aleatório para a execução.
const SEGREDO_JWT: string = (() => {
  const valor = process.env.JWT_SECRET ?? '';
  if (valor.length < 16 || valor === SEGREDO_DE_EXEMPLO || valor === SEGREDO_ANTIGO_PADRAO) {
    console.warn(
      'Aviso: JWT_SECRET ausente ou de exemplo. Um segredo aleatório foi gerado para esta execução; os logins expiram quando o servidor reiniciar. Defina JWT_SECRET no .env (o instalador faz isso).'
    );
    return crypto.randomBytes(48).toString('hex');
  }
  return valor;
})();

function segredo(): string {
  return SEGREDO_JWT;
}

// Segredo efetivo do servidor (o do .env ou o aleatório desta execução). Usado também para
// derivar a chave que cifra segredos guardados no banco (lib/cripto.ts).
export function segredoDoServidor(): string {
  return SEGREDO_JWT;
}

export function gerarToken(u: UsuarioToken): string {
  return jwt.sign(
    { id: u.id, perfil: u.perfil, alunoId: u.alunoId, professorId: u.professorId },
    segredo(),
    { expiresIn: '12h' }
  );
}

export const autenticar: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const cabecalho = req.headers.authorization ?? '';
  if (!cabecalho.startsWith('Bearer ')) {
    res.status(401).json({ erro: 'Não autenticado' });
    return;
  }
  const token = cabecalho.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, segredo()) as jwt.JwtPayload;
    const perfilVerdadeiro = payload.perfil as Perfil;
    req.usuario = {
      id: payload.id,
      // TI tem o mesmo acesso do ADMIN nas permissões; o verdadeiro fica em perfilReal.
      perfil: perfilVerdadeiro === 'TI' ? 'ADMIN' : perfilVerdadeiro,
      perfilReal: perfilVerdadeiro,
      alunoId: payload.alunoId ?? null,
      professorId: payload.professorId ?? null,
    };
  } catch {
    res.status(401).json({ erro: 'Não autenticado' });
    return;
  }
  next();
};

export function permitir(...perfis: Perfil[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      res.status(403).json({ erro: 'Sem permissão' });
      return;
    }
    next();
  };
}
