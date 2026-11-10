# Mini-plano g02: base do cliente

## Objetivo

Criar o esqueleto do app web em `client/`: projeto Vite/React/TypeScript, login, layout responsivo dos três portais, componentes visuais compartilhados, registro automático de módulos e PWA. Os outros geradores vão escrever telas usando os seus componentes, então nomes e props têm de ser exatamente os do contrato.

Leia antes: `docs/plano/CONTRATOS.md` (seções 1, 2, 5.1, 6 e 7).

## Arquivos que você pode criar (e só estes)

- `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`
- `client/public/manifest.webmanifest`, `client/public/icone.svg`, `client/public/sw.js`
- `client/src/main.tsx`, `client/src/App.tsx`, `client/src/vite-env.d.ts`
- `client/src/lib/tipos.ts`, `client/src/lib/api.ts`, `client/src/lib/auth.tsx`, `client/src/lib/rotas.ts`, `client/src/lib/useDados.ts`
- `client/src/ui/index.tsx`, `client/src/ui/estilo.css`
- `client/src/layout/Layout.tsx`, `client/src/layout/Login.tsx`, `client/src/layout/Painel.tsx`
- `client/src/modules/inicio/index.tsx`

Não crie `Dockerfile` nem `nginx.conf` (são do g03).

## Passos

1. `package.json`: nome `sistema-escolar-client`, `private: true`, `"type": "module"`, dependências com as versões exatas da seção 2 (sem `^`). Scripts: `"dev": "vite"`, `"build": "tsc --noEmit && vite build"`, `"typecheck": "tsc --noEmit"`, `"preview": "vite preview"`.
2. `tsconfig.json`: `target ES2020`, `lib ["ES2020","DOM","DOM.Iterable"]`, `module ESNext`, `moduleResolution bundler`, `jsx react-jsx`, `strict true`, `skipLibCheck true`, `noEmit true`, `types ["vite/client"]`, `include ["src"]`.
3. `vite.config.ts`: plugin React; `server.port 5173`; `server.proxy['/api'] = 'http://localhost:3000'`.
4. `index.html`: `lang="pt-BR"`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<meta name="theme-color" content="#1d4ed8">`, link do manifesto, `apple-touch-icon` para `/icone.svg`, título `Sistema Escolar`.
5. PWA: `manifest.webmanifest` (`name` "Sistema Escolar", `short_name` "Escola", `start_url` "/", `display` "standalone", `background_color` "#ffffff", `theme_color` "#1d4ed8", ícone `/icone.svg` com `sizes` "any" e `type` "image/svg+xml"); `icone.svg` simples (quadrado azul arredondado com um capelo ou livro branco); `sw.js` mínimo (escuta `install` com `skipWaiting`, `activate` com `clients.claim`, e `fetch` que só repassa para a rede, sem cache). Registre o service worker em `main.tsx` apenas quando `import.meta.env.PROD`.
6. `src/lib/tipos.ts`, `rotas.ts`, `useDados.ts`, `api.ts`, `auth.tsx`: exatamente as assinaturas da seção 6.
   - Token e usuário ficam em `localStorage` nas chaves `escola.token` e `escola.usuario`.
   - `api`: `fetch('/api' + caminho)`, cabeçalho `Authorization` quando houver token; resposta 204 devolve `undefined`; resposta não OK lança `new Error(corpo.erro ?? 'Erro inesperado')`; em 401 fora do login, limpa o `localStorage` e faz `window.location.assign('/login')`.
   - `auth.tsx`: `AuthProvider` + `useAuth`. `entrar` chama `POST /auth/login`.
   - `NIVEIS`: FUNDAMENTAL_1 "Fundamental I", FUNDAMENTAL_2 "Fundamental II", MEDIO "Ensino Médio", TECNICO "Técnico", GRADUACAO "Graduação", ESPECIALIZACAO "Especialização", MESTRADO "Mestrado", DOUTORADO "Doutorado".
7. `src/ui/index.tsx` e `estilo.css`: todos os componentes e funções listados na seção 6, com os mesmos nomes e props. Requisitos visuais:
   - CSS puro com variáveis (`--cor-primaria: #1d4ed8` etc.), fonte do sistema, celular primeiro.
   - `Tabela`: `<table>` a partir de 720 px; abaixo disso cada item vira um cartão com pares "título: valor".
   - `Modal`: ocupa a tela toda abaixo de 720 px; centralizado com largura máxima de 560 px acima.
   - Alvos de toque com pelo menos 44 px de altura; nada pode gerar rolagem horizontal em 360 px.
   - Suporte a tema escuro com `@media (prefers-color-scheme: dark)`.
8. `src/layout/Login.tsx`: formulário de e-mail e senha; ao entrar, redireciona para o portal do perfil (`ADMIN` e `SECRETARIA` para `/admin`, `PROFESSOR` para `/professor`, `ALUNO` para `/aluno`). Mostra erro em `<Aviso tipo="erro">`.
9. `src/layout/Layout.tsx`: recebe a lista de rotas de menu do perfil logado.
   - A partir de 900 px: barra lateral fixa com nome do sistema, nome do portal ("Administrativo", "Professor" ou "Aluno"), itens do menu (ícone + rótulo, item ativo destacado), nome do usuário e botão "Sair".
   - Abaixo de 900 px: barra superior com o título e botão de menu; barra inferior fixa com os 4 primeiros itens do menu e um item "Mais" que abre uma gaveta com todos os itens e o "Sair".
   - O conteúdo vem de `<Outlet />`.
10. `src/layout/Painel.tsx`: busca `GET /painel` e mostra os cartões em `<Grade>` com uma saudação "Olá, {nome}".
11. `src/modules/inicio/index.tsx`: exporta `rotas` com `/admin` (perfis ADMIN e SECRETARIA), `/professor` e `/aluno`, todas com rótulo "Início", ícone 🏠, `ordem: 0` e `elemento: <Painel />`.
12. `src/App.tsx`:
    - junta os módulos com `import.meta.glob<{ rotas: RotaModulo[] }>('./modules/*/index.tsx', { eager: true })` e ordena por `ordem` (padrão 100);
    - rotas: `/login`; `/` redireciona para o portal do perfil ou para `/login`; todas as rotas de módulo ficam dentro do `Layout`, protegidas: sem login vai para `/login`, com perfil fora de `perfis` vai para o portal do próprio perfil;
    - menu = rotas do perfil logado com `menu !== false`;
    - rota desconhecida mostra "Página não encontrada" com link para o início.
13. `src/main.tsx`: `BrowserRouter` + `AuthProvider` + `App`, importa `./ui/estilo.css`.

## Critérios de aceite

- `cd client && npm install && npx tsc --noEmit && npx vite build` terminam sem erro.
- Tudo que a seção 6 lista existe com o mesmo nome, as mesmas props e os mesmos tipos.
- Um arquivo novo `src/modules/<x>/index.tsx` exportando `rotas` aparece no menu sem editar `App.tsx`.
- Em 360 px de largura o login e o layout não têm rolagem horizontal e a barra inferior aparece.

## Verificação

```
cd client
npm install
npx tsc --noEmit
npx vite build
```
