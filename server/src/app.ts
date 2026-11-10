import express, { Request, Response, NextFunction, Router } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { HttpError } from './lib/erros';
import { autenticar } from './lib/auth';

interface ModuloRotas {
  publico?: Router;
  default?: Router;
}

function carregarModulos(): { nome: string; mod: ModuloRotas }[] {
  const dirModulos = path.join(__dirname, 'modules');
  const pastas = fs
    .readdirSync(dirModulos, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .filter(
      (nome) =>
        fs.existsSync(path.join(dirModulos, nome, 'routes.ts')) ||
        fs.existsSync(path.join(dirModulos, nome, 'routes.js'))
    )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return pastas.map((nome) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(path.join(dirModulos, nome, 'routes')) as ModuloRotas;
    return { nome, mod };
  });
}

function tratarErro(e: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (e instanceof HttpError) {
    res.status(e.status).json({ erro: e.message, detalhes: e.detalhes });
    return;
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      res.status(409).json({ erro: 'Registro duplicado' });
      return;
    }
    if (e.code === 'P2025') {
      res.status(404).json({ erro: 'Registro não encontrado' });
      return;
    }
  }
  if ((e as { type?: string })?.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'JSON inválido' });
    return;
  }
  console.error(`Erro em ${req.method} ${req.originalUrl}:`, e);
  res.status(500).json({ erro: 'Erro interno' });
}

export function criarApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const modulos = carregarModulos();

  // Primeiro todas as rotas públicas, depois as autenticadas.
  for (const { mod } of modulos) {
    if (mod.publico) {
      app.use('/api', mod.publico);
    }
  }
  for (const { mod } of modulos) {
    if (mod.default) {
      app.use('/api', autenticar, mod.default);
    }
  }

  app.use((_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
  });

  app.use(tratarErro);

  return app;
}
