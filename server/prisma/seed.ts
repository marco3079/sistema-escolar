// Seed padrão: cria só a conta de administrador.
// Idempotente: se já houver usuários, não faz nada.
// Os dados de demonstração ficam em seed-demo.ts e só entram com SEED_DEMO=true.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { carregarDemonstracao } from './seed-demo';

const prisma = new PrismaClient();

const ALFABETO_SENHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TAMANHO_SENHA = 16;

// Senha aleatória de 16 caracteres, sem caracteres ambíguos.
function gerarSenha(): string {
  const bytes = randomBytes(TAMANHO_SENHA);
  let senha = '';
  for (let i = 0; i < TAMANHO_SENHA; i += 1) {
    senha += ALFABETO_SENHA[bytes[i] % ALFABETO_SENHA.length];
  }
  return senha;
}

async function main(): Promise<void> {
  if ((await prisma.usuario.count()) > 0) {
    console.log('Banco já possui dados, seed ignorado.');
    return;
  }

  const nome = process.env.ADMIN_NOME || 'Administrador';
  const email = (process.env.ADMIN_EMAIL || 'admin@escola.local').trim().toLowerCase();
  const senhaEnv = process.env.ADMIN_SENHA || '';
  const demo = process.env.SEED_DEMO === 'true';

  // Com a demonstração, o e-mail dela já existe: ela cria o administrador.
  if (demo && email === 'admin@escola.demo') {
    console.log('Administrador será criado pelos dados de demonstração.');
  } else {
    let senha = senhaEnv;
    let gerada = false;
    if (senha.length < 8) {
      senha = gerarSenha();
      gerada = true;
    }

    await prisma.usuario.create({
      data: {
        nome,
        email,
        perfil: 'ADMIN',
        ativo: true,
        senhaHash: bcrypt.hashSync(senha, 10),
      },
    });

    console.log('==== ADMINISTRADOR CRIADO ====');
    console.log(`E-mail: ${email}`);
    if (gerada) {
      console.log(`Senha gerada: ${senha}`);
    }
    console.log('Troque a senha em "Meu perfil" depois do primeiro acesso.');
    console.log('==============================');
  }

  if (demo) {
    await carregarDemonstracao(prisma);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e: unknown) => {
    console.error('Erro ao executar o seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
