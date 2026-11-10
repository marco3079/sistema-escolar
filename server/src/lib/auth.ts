import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Perfil } from '@prisma/client';

export interface UsuarioToken {
  id: number;
  perfil: Perfil;
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

function segredo(): string {
  return process.env.JWT_SECRET ?? 'dev-secret';
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
    req.usuario = {
      id: payload.id,
      perfil: payload.perfil,
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
