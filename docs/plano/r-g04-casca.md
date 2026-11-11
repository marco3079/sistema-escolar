# Mini-plano g04: casca do app (barra lateral, topo, busca, sino, menu do usuário)

## Objetivo

Refazer a casca do app igual ao exemplo do usuário: barra lateral com logo, menu em seções e cartão no rodapé; topo com busca, sino de avisos e menu do usuário; e, no celular, barra superior compacta, barra inferior e gaveta.

Leia antes: `docs/plano/redesenho.md` inteiro; abra a referência `.claude/referencias/exemplo.png` (Read) e observe a barra lateral e o topo nos dois temas; leia `client/src/layout/Layout.tsx` (versão atual, que você vai reescrever), `client/src/App.tsx` (como o `Layout` é usado e quais props recebe), `client/src/lib/rotas.ts`, `client/src/lib/auth.tsx`, `client/src/lib/api.ts`, `client/src/lib/useDados.ts` e `client/src/ui/icones.tsx`.

## Arquivos que você pode criar ou editar (e só estes)

- `client/src/layout/Layout.tsx` (reescrever)
- `client/src/layout/casca.css` (novo; importado por `Layout.tsx`)
- `client/src/layout/grupos.ts` (novo)
- `client/src/layout/Busca.tsx` (novo)
- `client/src/layout/Notificacoes.tsx` (novo)
- `client/src/layout/MenuUsuario.tsx` (novo)

Não mude as props que `App.tsx` passa ao `Layout`, nem os nomes exportados por `Layout.tsx` (`Layout`, `nomePortal`, `caminhoDoPerfil` e o que mais existir hoje): `App.tsx` e `Login.tsx` os importam.

## Regras gerais

- Todas as classes novas começam com `casca-`. Cores, raios e sombras só pelas variáveis do contrato visual (`var(--cor-...)`, `var(--raio)`, `var(--sombra)`, `var(--gradiente-primario)`, `var(--largura-lateral)`...). Nenhuma cor fixa em `casca.css`, salvo `rgba` em sombras e no fundo escurecido da gaveta.
- Ícones só com `<Icone nome="..." />`. Nomes novos disponíveis: `busca`, `sino`, `chevron-baixo`, `seta-direita` (o g02 está acrescentando; a lista está no contrato).
- Abaixo de 900 px a barra lateral some.

## Passos

1. `grupos.ts`: exporta
   ```ts
   export interface GrupoMenu { titulo: string; icones: NomeIcone[] }
   export const GRUPOS: GrupoMenu[] = [
     { titulo: '', icones: ['inicio'] },
     { titulo: 'Pessoas', icones: ['alunos', 'professores', 'usuarios'] },
     { titulo: 'Acadêmico', icones: ['cursos', 'periodos', 'turmas', 'matriculas'] },
     { titulo: 'Ensino', icones: ['diario', 'boletim', 'historico', 'pos'] },
     { titulo: 'Gestão', icones: ['financeiro', 'biblioteca'] },
     { titulo: 'Agenda', icones: ['horarios', 'calendario', 'comunicados'] },
     { titulo: 'Conta', icones: ['perfil'] },
   ];
   export function agrupar(rotas: RotaModulo[]): { titulo: string; rotas: RotaModulo[] }[];
   ```
   `agrupar` distribui as rotas do menu pelos grupos conforme o `icone` de cada rota, mantém a ordem de `ordem` dentro do grupo, descarta grupos vazios e põe num grupo final "Outros" qualquer rota cujo ícone não esteja na lista.
2. **Barra lateral** (a partir de 900 px; fixa, altura total, largura `var(--largura-lateral)`, fundo `var(--cor-superficie)`, borda direita `var(--cor-borda)`):
   - topo: `<img src="/logo-simbolo.png" width={40} height={40}>` com raio de 22%, e ao lado "Sistema Escolar" (peso 800, 1.05rem) com o nome do portal embaixo (0.78rem, `var(--cor-texto-suave)`);
   - menu com rolagem própria: para cada grupo, o título em maiúsculas pequenas (0.68rem, peso 700, `var(--cor-texto-suave)`, com espaçamento entre letras) e os itens; cada item é um `NavLink` com ícone de 20 px e rótulo, altura de 42 px, raio `var(--raio-pequeno)`, texto `var(--cor-texto-suave)` em peso 600; no `:hover`, fundo `var(--cor-superficie-2)`; **ativo**: `background: var(--gradiente-primario)`, texto e ícone brancos, `box-shadow: var(--sombra-primaria)`;
   - rodapé: cartão com raio `var(--raio)`, fundo `var(--cor-primaria-suave)`, a frase "Construindo um futuro melhor." (peso 700, duas linhas) e a ilustração `/ilustracoes/capelo.png` como `background-image` à direita (`background-size: contain; background-position: right bottom; background-repeat: no-repeat`), altura de cerca de 96 px. No tema escuro use `mix-blend-mode` ou opacidade para a imagem não ficar com fundo branco aparente (por exemplo `opacity: 0.9` e `border-radius` no cartão com `overflow: hidden`); se o arquivo não existir, o cartão fica só com a frase.
3. **Topo** (a partir de 900 px; dentro da área de conteúdo, não fixa): à esquerda o componente `Busca` (largura máxima de 520 px); à direita `Notificacoes` e `MenuUsuario`.
4. `Busca.tsx`: campo arredondado (raio 999px, altura 44 px, fundo `var(--cor-superficie)`, borda `var(--cor-borda)`) com o ícone `busca` e o placeholder "Buscar por alunos, professores, turmas...". Ao digitar 2 ou mais caracteres, espera 300 ms e chama `api.get<Resultado[]>('/busca?q=' + encodeURIComponent(texto))`; ignore respostas de buscas antigas. Mostra um painel suspenso abaixo do campo com: primeiro as **telas** do menu cujo rótulo contém o texto (recebidas por prop, tipo "Tela"), depois os resultados da API agrupados por `tipo`; cada item mostra título e subtítulo e, ao clicar, navega para `caminho` (`useNavigate`) e fecha. "Nenhum resultado" quando vazio. Fecha com `Escape` e ao clicar fora. Setas para cima/baixo e `Enter` navegam pela lista. Atributos de acessibilidade: `role="combobox"`, `aria-expanded`, `role="listbox"` e `role="option"`.
5. `Notificacoes.tsx`: botão redondo (44 px, borda `var(--cor-borda)`) com o ícone `sino`; busca `GET /comunicados` com `useDados` e mostra um contador vermelho (`var(--cor-perigo)`, texto branco, 18 px) com a quantidade de `lido === false` (some quando for 0; "9+" acima de 9). Ao clicar, abre um painel suspenso com os 5 comunicados mais recentes (título, autor e data com `formatarDataHora`, marcador azul nos não lidos) e um link "Ver todos" para a tela de comunicados do portal (`/admin/comunicados`, `/professor/comunicados` ou `/aluno/comunicados`). Clicar num item chama `POST /comunicados/{id}/ler` (se não lido), recarrega e navega para a tela de comunicados. `aria-label="Avisos"`.
6. `MenuUsuario.tsx`: avatar redondo de 40 px com as iniciais do usuário (primeira letra do primeiro e do último nome), fundo `var(--cor-texto)` e texto `var(--cor-superficie)`; ao lado, o nome (peso 700, 0.9rem) e o papel (ADMIN "Administrador", SECRETARIA "Secretaria", PROFESSOR "Professor", ALUNO "Aluno"; 0.78rem, suave) e o ícone `chevron-baixo`. Ao clicar abre um menu com "Meu perfil" (só para PROFESSOR e ALUNO, levando a `/professor/perfil` ou `/aluno/perfil`) e "Sair". Fecha com `Escape` e ao clicar fora.
7. **Celular (abaixo de 900 px)**:
   - barra superior fixa com a logo (28 px), o nome do portal, o `Notificacoes` e um botão com o ícone `menu` (`aria-label="Abrir menu"`) que abre a gaveta;
   - abaixo dela, o campo `Busca` ocupando a largura toda;
   - barra inferior fixa com os 4 primeiros itens do menu e o item "Mais" (ícone `mais`) que abre a gaveta; o item ativo em `var(--cor-primaria)`; rótulos com 0.68rem e reticências;
   - gaveta: painel que sobe de baixo, com os grupos e itens (mesmo visual da barra lateral), o nome do usuário e o botão "Sair". **Atenção:** a gaveta e o seu fundo só são renderizados quando abertos; a regra CSS do fundo tem de ter `display: flex` (um defeito anterior deixava `display: none` e a gaveta nunca aparecia).
   - o conteúdo ganha `padding-bottom` igual à altura da barra inferior mais `env(safe-area-inset-bottom)`.
8. A área de conteúdo (`<main>`) fica à direita da barra lateral (`margin-left: var(--largura-lateral)` a partir de 900 px), com padding de 1.5rem (1rem no celular) e largura máxima de 1440 px. O conteúdo das telas vem de `<Outlet />`.
9. Espere o `done` do g02 (ícones) na sala antes da verificação final, se você usar os nomes novos de ícone.

## Critérios de aceite

- `Layout` recebe as mesmas props de hoje e `App.tsx` compila sem mudança.
- Menu agrupado em seções na barra lateral e na gaveta; item ativo em pílula azul com degradê.
- Busca, sino e menu do usuário funcionam como descrito e fecham com `Escape` e clique fora.
- A gaveta abre e fecha no celular; nada gera rolagem horizontal em 360 px.
- Nenhuma cor fixa em `casca.css` (salvo `rgba` de sombras e do fundo da gaveta).
- `cd client && npx tsc --noEmit` com zero erro em `src/layout/` e `npx vite build` sem erro (apague `client/dist`).

## Verificação

```
cd client
npx tsc --noEmit
npx vite build
```

Não rode `npm install`, não suba Docker nem servidor.
