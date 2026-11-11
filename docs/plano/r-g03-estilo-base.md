# Mini-plano g03: estilo base e componentes

## Objetivo

Dar a todos os componentes compartilhados (cartões, botões, tabelas, formulários, modais, abas, selos, avisos) o visual do exemplo do usuário, trocando as variáveis de cor e restilizando as regras de `client/src/ui/estilo.css`. Como todas as telas internas usam esses componentes, é este arquivo que leva o redesenho a elas.

Leia antes: `docs/plano/redesenho.md` (seções "Como é o exemplo" e "Contrato visual"), abra a referência `.claude/referencias/exemplo.png` (Read), e leia inteiros `client/src/ui/estilo.css` e `client/src/ui/index.tsx` (para saber quais classes cada componente usa).

## Arquivo que você pode editar (e só este)

- `client/src/ui/estilo.css`

Não edite `client/src/ui/index.tsx`: os nomes das classes dos componentes **não mudam**.

## Passos

1. **Variáveis.** Reescreva o bloco `:root` e o bloco `@media (prefers-color-scheme: dark)` com **todas** as variáveis da tabela "Contrato visual" do `redesenho.md`, nomes e valores exatos, claro em `:root` e escuro dentro do `@media`. Mantenha qualquer outra variável que já exista e seja usada no arquivo.
2. **Base.** `body` com `background: var(--cor-fundo)`, `color: var(--cor-texto)`, a pilha de fontes do contrato, `-webkit-font-smoothing: antialiased`. Títulos (`h1`, `h2`, `h3`) em peso 700 com `letter-spacing: -0.01em`.
3. **Componentes** (mantenha os seletores atuais; mude só a aparência):
   - Cartão (`Cartao`, e o cartão em que a `Tabela` se transforma no celular): fundo `var(--cor-superficie)`, borda `1px solid var(--cor-borda)`, raio `var(--raio)`, sombra `var(--sombra)`, padding de 1.1rem a 1.25rem.
   - Título de página (`Pagina`): título com 1.6rem e peso 800; ações alinhadas à direita; no celular as ações vão para baixo do título.
   - Botões: raio `var(--raio-pequeno)`, altura mínima de 44 px, peso 600. Primário com `background: var(--gradiente-primario)`, texto branco e `box-shadow: var(--sombra-primaria)`. Secundário com fundo `var(--cor-superficie)`, borda `var(--cor-borda)` e texto `var(--cor-texto)`. Perigo com fundo `var(--cor-perigo)` e texto branco. Texto: sem fundo, cor `var(--cor-primaria)`. Estado desabilitado com opacidade 0.55. Foco visível com `outline: 2px solid var(--cor-primaria)` e `outline-offset: 2px`.
   - Campos (`input`, `select`, `textarea`): fundo `var(--cor-superficie)`, borda `1px solid var(--cor-borda)`, raio `var(--raio-pequeno)`, altura mínima 44 px; ao focar, borda `var(--cor-primaria)` e `box-shadow: 0 0 0 3px var(--cor-primaria-suave)`. Rótulo com 0.85rem, peso 600, cor `var(--cor-texto-suave)`.
   - Tabela: dentro de um cartão; cabeçalho com fundo `var(--cor-superficie-2)`, texto 0.78rem em maiúsculas, peso 700, cor `var(--cor-texto-suave)`; linhas separadas por `1px solid var(--cor-borda)`; linha com `:hover` em `var(--cor-superficie-2)`; primeira e última célula com padding lateral maior; cantos do cartão arredondados (use `overflow: hidden` no contêiner).
   - Selo: pílula com raio 999px, 0.75rem, peso 700; cada cor usa o par suave + forte do contrato (verde: fundo `--cor-verde-suave`, texto `--cor-sucesso`; azul: `--cor-azul-suave` e `--cor-primaria`; amarelo: `--cor-laranja-suave` e `--cor-aviso`; vermelho: fundo com `color-mix(in srgb, var(--cor-perigo) 14%, transparent)` e texto `--cor-perigo`; cinza: `--cor-superficie-2` e `--cor-texto-suave`).
   - Aviso: fundo suave da cor do tipo, borda esquerda de 4 px na cor forte, raio `var(--raio-pequeno)`.
   - Modal: fundo escurecido `rgba(15, 23, 42, 0.45)`; caixa com raio `var(--raio)`, sombra forte; cabeçalho com título 1.15rem peso 700; continua em tela cheia abaixo de 720 px.
   - Abas: itens em pílulas; a ativa com fundo `var(--cor-primaria-suave)` e texto `var(--cor-primaria)`, peso 700; rolagem horizontal interna no celular.
   - Grade: `gap` de 1rem, colunas `repeat(auto-fit, minmax(220px, 1fr))`.
   - Carregando: texto em `var(--cor-texto-suave)`.
4. **Remoção das regras antigas de casca.** A barra lateral, a barra superior, a barra inferior, a gaveta, o login e o painel estão sendo refeitos por outros geradores com classes novas (`casca-`, `painel-`, `entrada-`). Apague de `estilo.css` as regras que servem só a eles. Antes de apagar cada seletor, confirme com `grep -rn "nome-da-classe" client/src` que ele só aparece em `client/src/layout/` (Layout.tsx, Login.tsx, Painel.tsx). Se aparecer em `client/src/ui/index.tsx` ou em `client/src/modules/`, **mantenha**.
5. Varra o arquivo: nenhuma cor fixa (`#...`, `rgb(...)`) fora dos dois blocos de variáveis, salvo sombras em `rgba` e o fundo do modal.
6. Rode a verificação.

## Critérios de aceite

- Todas as variáveis do contrato existem com os valores exatos, em claro e em escuro.
- Nenhum seletor usado por `client/src/ui/index.tsx` ou por `client/src/modules/**` foi removido (confira com grep, classe por classe, e liste no `done` os seletores que apagou).
- Nada gera rolagem horizontal em 360 px; alvos de toque com pelo menos 44 px.
- `cd client && npx tsc --noEmit` e `npx vite build` sem erro (apague `client/dist` depois).

## Verificação

```
cd client
npx tsc --noEmit
npx vite build
```

Não rode `npm install`. Enquanto os outros geradores não terminarem, a casca do app pode aparecer sem estilo: é esperado.
