# Mini-plano g01: base do servidor

## Objetivo

Criar o esqueleto da API em `server/`: projeto Node/TypeScript, código compartilhado de `src/lib`, carregador de módulos, autenticação e painel. Os outros geradores vão escrever módulos em cima do que você entregar, então as assinaturas têm de ser exatamente as do contrato.

Leia antes: `docs/plano/CONTRATOS.md` (seções 2, 3, 4 e 5.1) e `server/prisma/schema.prisma`.

## Arquivos que você pode criar (e só estes)

- `server/package.json`
- `server/tsconfig.json`
- `server/.env.example`
- `server/src/server.ts`
- `server/src/app.ts`
- `server/src/lib/prisma.ts`
- `server/src/lib/erros.ts`
- `server/src/lib/auth.ts`
- `server/src/lib/regras.ts`
- `server/src/modules/auth/routes.ts`

Não altere `server/prisma/schema.prisma`. Não crie `Dockerfile` (é do g03) nem `prisma/seed.ts` (tarefa posterior).

## Passos

1. `server/package.json`: nome `sistema-escolar-server`, `private: true`, dependências e versões exatas da seção 2 do contrato (`express`, `@prisma/client`, `zod`, `bcryptjs`, `jsonwebtoken`, `cors`, `tsx`, `prisma`, `typescript` e os `@types` em `dependencies`, tudo com versão exata, sem `^`). Scripts:
   - `"dev": "tsx watch src/server.ts"`
   - `"start": "tsx src/server.ts"`
   - `"typecheck": "tsc --noEmit"`
   - `"seed": "tsx prisma/seed.ts"`
   - `"db:push": "prisma db push --skip-generate"`
   - `"postinstall": "prisma generate"`
2. `server/tsconfig.json`: `target ES2022`, `module commonjs`, `moduleResolution node`, `strict true`, `esModuleInterop true`, `skipLibCheck true`, `resolveJsonModule true`, `noEmit true`, `include: ["src", "prisma"]`.
3. `server/.env.example` com:
   ```
   DATABASE_URL=postgresql://escola:escola@localhost:5432/escola?schema=public
   JWT_SECRET=troque-este-segredo-de-exemplo
   PORT=3000
   ```
4. `src/lib/prisma.ts`: `export const prisma = new PrismaClient();`.
5. `src/lib/erros.ts`: `HttpError`, `asyncHandler`, `idParam`, `validar` exatamente como na seção 4. `validar` usa `schema.safeParse` e lança `new HttpError(400, 'Dados inválidos', resultado.error.issues)`.
6. `src/lib/auth.ts`:
   - `UsuarioToken`, `gerarToken` (JWT com `process.env.JWT_SECRET ?? 'dev-secret'`, validade `12h`), `autenticar`, `permitir`.
   - `autenticar`: lê `Authorization: Bearer`, verifica o token, coloca o conteúdo em `req.usuario`; sem token ou token inválido responde 401 `{ erro: 'Não autenticado' }`.
   - `permitir(...perfis)`: 403 `{ erro: 'Sem permissão' }` se o perfil não estiver na lista.
   - Declaração global: `declare global { namespace Express { interface Request { usuario: UsuarioToken } } }` (não opcional, para os módulos usarem `req.usuario.id` sem `!`).
7. `src/lib/regras.ts`: `FREQUENCIA_MINIMA`, `mediaMinima`, `calcularSituacao`, `ehPos` conforme a seção 4.
8. `src/modules/auth/routes.ts` (seção 5.1). Este router é especial: exporta **dois** routers nomeados além do default:
   - `export const publico = Router()` com `GET /saude` e `POST /auth/login`;
   - `export default router` com `GET /auth/me`, `POST /auth/trocar-senha`, `GET /painel`.
   - Login: busca por e-mail, confere `ativo` e `bcrypt.compare`; carrega `aluno` e `professor` para preencher `alunoId` e `professorId`; erro único 401 `E-mail ou senha inválidos`.
   - `GET /painel`: cartões por perfil conforme a seção 5.1, com `prisma.<modelo>.count`.
9. `src/app.ts`: exporta `criarApp()` que:
   - cria o Express, usa `cors()` e `express.json()`;
   - percorre `fs.readdirSync(path.join(__dirname, 'modules'))` em ordem alfabética; para cada pasta faz `require(path.join(pasta, 'routes'))`; se o módulo exportar `publico`, monta `app.use('/api', mod.publico)` **antes** de qualquer router autenticado; depois monta `app.use('/api', autenticar, mod.default)` para cada um;
   - rota final 404 `{ erro: 'Rota não encontrada' }`;
   - middleware de erro: `HttpError` vira `res.status(e.status).json({ erro: e.message, detalhes: e.detalhes })`; erro Prisma com código `P2002` vira 409 `Registro duplicado`; `P2025` vira 404 `Registro não encontrado`; o resto vira 500 `Erro interno` com `console.error`.
   - Atenção: monte primeiro todos os `publico`, depois todos os `default`, em dois laços separados.
10. `src/server.ts`: `criarApp().listen(Number(process.env.PORT ?? 3000), ...)` com um `console.log` da porta.

## Critérios de aceite

- `cd server && npm install` termina sem erro e gera o Prisma Client.
- `cd server && npx tsc --noEmit` termina com zero erro.
- Todas as funções da seção 4 existem com os nomes e assinaturas do contrato.
- Um módulo novo colocado em `src/modules/<x>/routes.ts` com `export default router` é carregado sem editar `app.ts`.
- Nenhuma resposta devolve `senhaHash`.

## Verificação

```
cd server
npm install
npx tsc --noEmit
```

Não suba banco nem Docker.
