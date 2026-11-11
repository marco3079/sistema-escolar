# Rodada V: botão de tema e layout de "Dados e segurança"

Pedido do usuário (print da aba "Dados e segurança" de "Meu perfil"): "arruma esse layout e coloca um botão para mudar o tema".

Hoje o tema escuro só segue o aparelho (`@media (prefers-color-scheme: dark)`). Passa a existir uma preferência do usuário: **Sistema** (segue o aparelho, padrão), **Claro** ou **Escuro**, guardada no navegador.

## Contrato do tema (vale para os dois geradores)

- Atributo no elemento raiz: `<html data-tema="claro">` ou `<html data-tema="escuro">`. Sem o atributo, vale o aparelho.
- `localStorage`, chave `escola.tema`, valores `claro` ou `escuro`; chave ausente = Sistema. Todo acesso com `try/catch`.
- Arquivo novo `client/src/lib/tema.ts`, com exatamente estas exportações:

```ts
export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';
export type TemaEfetivo = 'claro' | 'escuro';

export function lerPreferenciaTema(): PreferenciaTema;
export function definirPreferenciaTema(preferencia: PreferenciaTema): void; // grava, aplica o atributo e avisa os componentes
export function useTema(): {
  preferencia: PreferenciaTema;
  temaEfetivo: TemaEfetivo;            // o que está na tela agora
  definir: (preferencia: PreferenciaTema) => void;
  alternar: () => void;                // claro <-> escuro, a partir do tema efetivo
};
```

- `useTema` usa `useSyncExternalStore` com um estado de módulo, para que o botão do topo e o cartão do perfil mudem juntos; em "Sistema", acompanha `matchMedia('(prefers-color-scheme: dark)')` (evento `change`).
- Ícones novos em `client/src/ui/icones.tsx`: `sol`, `lua` e `monitor` (sólidos, no mesmo estilo e `viewBox` dos existentes; entram em `NomeIcone` e em `NOMES_ICONES`).

## Parte 1 (g18): base do tema e botão no topo

Arquivos (e só estes): `client/src/lib/tema.ts` (novo), `client/index.html`, `client/src/ui/estilo.css` (só o bloco do tema escuro e uma classe do botão, se precisar), `client/src/layout/painel.css` (só os dois blocos `@media (prefers-color-scheme: dark)`), `client/src/ui/icones.tsx`, `client/src/layout/Layout.tsx`, `client/src/layout/casca.css`, `client/src/layout/MenuUsuario.tsx`, e a tela de login (`Login.tsx` e o CSS dela; ache com Grep).

1. `tema.ts` conforme o contrato.
2. `index.html`: um `<script>` curto no `<head>`, antes do CSS, que lê `escola.tema` (com `try/catch`) e, se for `claro` ou `escuro`, põe `data-tema` em `document.documentElement`. Evita o clarão ao abrir. Acrescente `<meta name="color-scheme" content="light dark">`.
3. `estilo.css`: as variáveis do tema escuro passam a valer em dois casos, sem duplicar a lista à mão mais do que o necessário:
   - `:root[data-tema='escuro'] { ...variáveis escuras... }`
   - `@media (prefers-color-scheme: dark) { :root:not([data-tema='claro']) { ...as mesmas variáveis... } }`
   Acrescente `color-scheme: light` no `:root` base e `color-scheme: dark` nos dois blocos escuros (campos nativos, calendário de data e barras de rolagem acompanham).
4. `painel.css`: cada um dos dois blocos escuros (prédio e livros) passa a valer nos mesmos dois casos (seletor com `:root[data-tema='escuro'] .painel::before` e, dentro do `@media`, `:root:not([data-tema='claro']) .painel::before`; idem para `.painel-destaque::before`).
5. Procure outros usos de `prefers-color-scheme` em `client/src` e em `client/public` (Grep); se houver em arquivo fora da sua lista, avise na sala em vez de editar.
6. Ícones `sol`, `lua`, `monitor`.
7. Botão de tema no topo, ao lado do sino, no computador (`casca-topo-acoes`) e no celular (`casca-topo-celular-acoes`): botão redondo igual ao do sino, com o ícone `lua` quando a tela está clara e `sol` quando está escura; `aria-label` e `title` "Mudar para o tema escuro" / "Mudar para o tema claro"; chama `alternar()`.
8. `MenuUsuario.tsx`: entre "Suporte" e "Sair", um item "Tema escuro" / "Tema claro" (o destino), com o mesmo ícone, que chama `alternar()` sem fechar a sessão.
9. Tela de login: o mesmo botão redondo num canto superior da tela, sem atrapalhar o formulário.
10. Verificação: `cd client && npx tsc --noEmit`.

Aceite: clicar no botão troca o tema na hora, em todas as telas, e a escolha continua depois de recarregar; com a chave ausente o sistema segue o aparelho como antes; nenhuma cor fixa nova fora dos blocos de variáveis.

## Parte 2 (g19): aba "Dados e segurança"

Arquivos (e só estes): `client/src/modules/cadastros/perfil.tsx` e `client/src/modules/cadastros/perfil.css`. Use `useTema` de `client/src/lib/tema.ts` e os ícones `sol`, `lua`, `monitor` (o g18 grava; se o typecheck reclamar deles, espere o `done` do g18 na sala e rode de novo).

Problemas do print: três cartões colados, sem espaço entre si; "Meus dados" como parágrafos soltos; campos esticados na largura inteira da tela (mais de 1500 px); botões perdidos no canto direito.

1. Grade de duas colunas a partir de 900 px (`perfil-dados-grade`, `gap: 1rem`, colunas iguais, `align-items: start`); abaixo disso, uma coluna. Largura máxima do conjunto: 1100 px.
2. Coluna esquerda:
   - **Meus dados**: lista de definição em linhas "rótulo à esquerda (texto suave), valor à direita (peso 600)", com divisória fina entre as linhas: Nome, E-mail, Perfil (rótulo em português: Administrador, TI, Secretaria, Professor, Aluno), CPF, e os campos de aluno (RA, Data de nascimento) ou professor (Registro, Titulação, Área) quando existirem. Uma frase curta em texto suave embaixo: "Para corrigir nome ou e-mail, fale com a secretaria."
   - **Contato**: o formulário atual, com o botão "Salvar dados" alinhado à esquerda, logo abaixo do campo.
3. Coluna direita:
   - **Trocar senha**: título com o ícone `cadeado`; os dois campos atuais mais um campo "Confirmar nova senha" (validação só no cliente: se for diferente da nova senha, mostra erro e não envia; a chamada à API não muda); botão "Trocar senha" à esquerda. Mantenha as mensagens de sucesso e erro atuais e o texto do mínimo de caracteres igual à regra que já existe.
   - **Aparência** (cartão novo): frase "Escolha o tema do sistema neste navegador." e três opções lado a lado em cartões clicáveis (`role="radiogroup"`, cada uma `role="radio"` com `aria-checked`): "Sistema" (ícone `monitor`, legenda "Segue o aparelho"), "Claro" (`sol`) e "Escuro" (`lua`); a escolhida fica destacada com `var(--cor-primaria)` na borda e `var(--cor-primaria-suave)` no fundo. Usa `preferencia` e `definir` de `useTema`. Em 360 px as três continuam cabendo (ou viram coluna).
4. Cores só por variáveis; classes novas com prefixo `perfil-`. Nada estoura em 360 px.
5. Verificação: `cd client && npx tsc --noEmit`.

Aceite: os cartões têm espaço entre si; em tela larga ficam em duas colunas sem campos de 1500 px; o tema muda pelo cartão "Aparência" e o botão do topo acompanha.
