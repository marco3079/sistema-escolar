# Mini-plano g01: banco nasce só com o administrador

## Objetivo

O sistema deixa de nascer com os dados de demonstração. O seed padrão cria só a conta de administrador; os dados de demonstração viram opcionais (`SEED_DEMO=true`).

Leia antes: `docs/plano/instalacao.md` (seções "Comportamento do seed" e "Dados de demonstração": é o contrato), `server/prisma/seed.ts` inteiro (742 linhas), `server/prisma/schema.prisma` (modelo `Usuario`) e `server/Dockerfile` (a última linha roda `npx tsx prisma/seed.ts` em toda subida).

## Arquivos que você pode criar ou editar (e só estes)

- `server/prisma/seed-demo.ts` (novo: recebe o conteúdo do seed atual)
- `server/prisma/seed.ts` (reescrito: só administrador + chamada opcional da demonstração)
- `server/.env.example`

Não altere `server/Dockerfile`, `schema.prisma` nem nada em `server/src`.

## Passos

1. **`seed-demo.ts`**: mova para ele TODO o conteúdo atual de `seed.ts` (auxiliares, dados e a lógica), com estas mudanças e nenhuma outra:
   - remova `const prisma = new PrismaClient();` do topo; a função principal passa a receber o cliente: `export async function carregarDemonstracao(prisma: PrismaClient): Promise<void>`;
   - se funções auxiliares usam a variável `prisma` de fora, passe o cliente por parâmetro ou declare-as dentro de `carregarDemonstracao`;
   - remova a verificação `if ((await prisma.usuario.count()) > 0) { ... return; }` do começo (quem decide é o `seed.ts`);
   - remova o bloco final `main().then(...).catch(...)` com `$disconnect` e `process.exit` (o arquivo não roda sozinho);
   - mantenha a mensagem final "Seed concluído: ..." trocando o começo para "Dados de demonstração carregados: ...";
   - todos os dados, e-mails e a senha `demo1234` continuam exatamente como estão.
2. **`seed.ts`** novo, curto:
   ```ts
   import { PrismaClient } from '@prisma/client';
   import bcrypt from 'bcryptjs';
   import { randomBytes } from 'crypto';
   import { carregarDemonstracao } from './seed-demo';
   ```
   - `gerarSenha()`: 16 caracteres aleatórios de um alfabeto sem caracteres ambíguos (`ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789`), usando `randomBytes` (um byte por caractere, índice = byte % tamanho do alfabeto).
   - `main()`:
     1. se `prisma.usuario.count() > 0`: `console.log('Banco já possui dados, seed ignorado.')` e retorna;
     2. lê `ADMIN_NOME` (padrão `Administrador`), `ADMIN_EMAIL` (padrão `admin@escola.local`, em minúsculas e sem espaços nas pontas) e `ADMIN_SENHA`;
     3. se `ADMIN_SENHA` estiver vazia ou tiver menos de 8 caracteres, usa `gerarSenha()` e marca `gerada = true`;
     4. cria o usuário com `perfil: 'ADMIN'`, `ativo: true`, `senhaHash: bcrypt.hashSync(senha, 10)`;
     5. imprime o bloco do contrato, linha por linha; a linha `Senha gerada: <senha>` só quando `gerada` for verdadeiro (senha vinda de `ADMIN_SENHA` nunca é impressa);
     6. se `process.env.SEED_DEMO === 'true'`: `await carregarDemonstracao(prisma);`.
   - Final: `main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });`
   - Atenção: com `SEED_DEMO=true` e `ADMIN_EMAIL=admin@escola.demo` haveria e-mail duplicado com o administrador da demonstração. Nesse caso (e só nele), pule a criação do administrador do passo 4 e deixe a demonstração criá-lo; imprima `Administrador será criado pelos dados de demonstração.`.
3. **`server/.env.example`**: acrescente, com um comentário curto para cada:
   ```
   ADMIN_NOME=Administrador
   ADMIN_EMAIL=admin@escola.local
   # Deixe vazio para o servidor gerar uma senha e mostrá-la no log da primeira subida.
   ADMIN_SENHA=
   # true carrega dados de demonstração fictícios (só para teste).
   SEED_DEMO=false
   ```
4. Rode a verificação.

## Critérios de aceite

- `server/prisma/seed.ts` não contém nenhum dado de demonstração nem a senha `demo1234`.
- `seed-demo.ts` exporta `carregarDemonstracao(prisma)` e não roda nada ao ser importado.
- Banco vazio + padrão: exatamente 1 usuário (ADMIN) e nenhum outro registro em nenhuma tabela.
- Banco vazio + `SEED_DEMO=true`: o administrador de `ADMIN_EMAIL` e todos os dados de demonstração de antes.
- Segunda execução: "Banco já possui dados, seed ignorado.", sem alterar nada.
- `cd server && npx tsc --noEmit` com zero erro.

## Verificação

```
cd server
npx tsc --noEmit
```

Não rode `npm install`, não suba banco nem Docker, e não mexa nos contêineres do sistema (o teste real é do revisor e do main).
