# Mini-plano g02: integração da logo e dos ícones no app

## Objetivo

Trocar os emojis do menu pelos ícones SVG novos e colocar a logo no login, no topo do app, na aba do navegador, no ícone do PWA e no README.

Leia antes: `docs/plano/identidade-visual.md` (contrato, tabela de troca dos emojis e nomes de arquivos), `client/src/layout/Layout.tsx`, `client/src/layout/Login.tsx`, `client/src/lib/rotas.ts`, `client/src/ui/estilo.css`.

Duas outras partes trabalham em paralelo e você **não** faz o trabalho delas:
- `g01` cria `client/src/ui/icones.tsx` com `Icone`, `NomeIcone` e `NOMES_ICONES` (assinatura no contrato).
- `arte` cria `client/public/logo-simbolo.png` (512 x 512) e `assets/artes/logo.png`.

Você só referencia esses arquivos pelos nomes do contrato.

## Arquivos que você pode editar (e só estes)

- `client/src/lib/rotas.ts`
- `client/src/layout/Layout.tsx`
- `client/src/layout/Login.tsx`
- `client/src/ui/estilo.css`
- `client/index.html`
- `client/public/manifest.webmanifest`
- `client/public/icone.svg` (apagar)
- `README.md`
- Nos módulos, **somente as linhas `icone: '...'`** de: `client/src/modules/inicio/index.tsx`, `cadastros/index.tsx`, `academico/index.tsx`, `matricula/index.tsx`, `matricula/aluno.tsx`, `diario/index.tsx`, `pos/index.tsx`, `financeiro/index.tsx`, `biblioteca/index.tsx`, `agenda/index.tsx`, `comunicados/index.tsx`

## Passos

1. `client/src/lib/rotas.ts`: `import type { NomeIcone } from '../ui/icones';` e troque o tipo do campo `icone` de `string` para `NomeIcone`. Atualize o comentário ("nome de um ícone de ui/icones").
2. Módulos: troque cada valor de `icone` conforme a tabela "Troca dos emojis" do contrato. São 35 linhas. Confira com `grep -rn "icone:" client/src/modules` que não sobrou nenhum emoji.
3. `client/src/layout/Layout.tsx`:
   - `import { Icone } from '../ui/icones';`
   - nos três lugares em que aparece `{r.icone}` dentro de `<span className="icone-menu">`, use `<Icone nome={r.icone} />`;
   - o botão do menu superior (`☰`) vira `<Icone nome="menu" />`, mantendo o `aria-label` do botão (acrescente `aria-label="Abrir menu"` se não houver);
   - o item "Mais" (`⋯`) vira `<Icone nome="mais" />`;
   - os dois botões "Sair" ganham `<Icone nome="sair" tamanho={18} />` antes do texto;
   - onde hoje está `<div className="marca">Sistema Escolar</div>`, coloque a logo antes do nome: `<div className="marca"><img src="/logo-simbolo.png" alt="" className="marca-logo" width={32} height={32} /><span>Sistema Escolar</span></div>`;
   - na barra superior do celular, coloque a mesma imagem (28 x 28) antes do título já existente.
4. `client/src/layout/Login.tsx`: acima do `<h1>Sistema Escolar</h1>`, `<img src="/logo-simbolo.png" alt="" className="login-logo" width={72} height={72} />`.
5. `client/src/ui/estilo.css` (só acrescente regras no fim do arquivo, sem alterar as existentes, salvo o item de rótulo abaixo):
   - `.marca { display: flex; align-items: center; gap: 0.6rem; }`
   - `.marca-logo, .login-logo { border-radius: 22%; display: block; flex-shrink: 0; }`
   - `.login-logo { margin-bottom: 0.75rem; }`
   - `.icone-menu { display: inline-flex; align-items: center; justify-content: center; }` e `.icone-menu svg { display: block; }`
   - rótulos da barra inferior do celular: hoje "Minhas turmas" aparece cortado. Encontre a regra do texto dos itens da barra inferior e garanta `font-size: 0.68rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;` e `min-width: 0` no item, para o rótulo longo encolher com reticências em vez de invadir o vizinho.
6. `client/index.html`: troque o `apple-touch-icon` para `/logo-simbolo.png` e acrescente `<link rel="icon" type="image/png" href="/logo-simbolo.png" />`.
7. `client/public/manifest.webmanifest`: a lista `icons` passa a ter duas entradas apontando para `/logo-simbolo.png`, `type: "image/png"`: uma com `sizes: "512x512"`, `purpose: "any"`, e outra com `sizes: "192x192"`, `purpose: "any"`. Apague `client/public/icone.svg`.
8. `README.md`: no topo, antes do título, acrescente
   `<p align="center"><img src="assets/artes/logo.png" alt="Sistema Escolar" width="420"></p>`
9. Espere o `done` do `g01` na sala (`BUS wait sistema_escolar --agent g02 --timeout 120`, repita se preciso) e só então rode a verificação final, porque você importa `client/src/ui/icones.tsx`.

## Critérios de aceite

- Nenhum emoji restante em `icone:` dos módulos, nem `☰` ou `⋯` em `Layout.tsx`.
- `cd client && npx tsc --noEmit` com zero erro no projeto inteiro (depois de o `g01` entregar).
- `cd client && npx vite build` termina sem erro; apague a pasta `dist` gerada.
- Nenhuma regra existente de `estilo.css` removida.
- `icone.svg` não é mais referenciado em lugar nenhum (`grep -rn "icone.svg" client README.md` sem resultado fora de `node_modules`).

## Verificação

```
cd client
npx tsc --noEmit
npx vite build
```

Não rode `npm install`, não suba Docker. Se `client/public/logo-simbolo.png` ainda não existir quando você terminar, tudo bem: o build não depende dele; registre isso no `done`.
