# Mini-plano g13: tela de Comunicados

## Objetivo

O usuário mandou um print da tela Comunicados (`/admin/comunicados`) dizendo "arruma aqui também": hoje cada comunicado é um cartão largo com o título, uma linha de dados e dois botões grandes ("Abrir" e "Excluir" vermelho), o que deixa a tela pesada e repetitiva. Refaça como uma caixa de avisos bem acabada.

Leia antes: `client/src/modules/comunicados/index.tsx`, `ListaComunicados.tsx`, `FormularioComunicado.tsx`, `comunicados.css`, `tipos.ts`; `client/src/ui/index.tsx`; `client/src/ui/estilo.css` (classes utilitárias `barra-ferramentas` e `filtros`, no fim); `client/src/ui/icones.tsx`. Abra a referência `.claude/referencias/exemplo.png` e observe o cartão "Avisos Recentes" (bolinha colorida, título em negrito, texto e tempo à direita): é esse o estilo.

## Arquivos que você pode editar (e só estes)

- `client/src/modules/comunicados/ListaComunicados.tsx`
- `client/src/modules/comunicados/comunicados.css`
- `client/src/modules/comunicados/index.tsx`
- `client/src/modules/comunicados/FormularioComunicado.tsx` (só se precisar de ajuste de layout)
- arquivos novos dentro de `client/src/modules/comunicados/`, se quiser dividir

A API não muda (`GET /comunicados`, `POST /comunicados`, `DELETE /comunicados/:id`, `POST /comunicados/:id/ler`). As três telas (`/admin/comunicados`, `/professor/comunicados`, `/aluno/comunicados`) continuam usando `ListaComunicados`.

## Passos

1. **Barra de ferramentas** (`barra-ferramentas`): à esquerda, um campo de busca por título ou texto e filtros em pílulas: "Todos", "Não lidos" (com a quantidade) e um `Selecao` de público (Toda a escola, Alunos, Professores, Turma, Curso); à direita, o botão "Novo comunicado" (quando a tela permite publicar). Os filtros funcionam no cliente, sobre a lista já carregada.
2. **Layout em duas colunas a partir de 1000 px** (lista à esquerda com cerca de 42% e leitura à direita); abaixo disso, só a lista, e a leitura abre em `Modal`.
3. **Lista**: um cartão único (`var(--cor-superficie)`, borda, raio, sombra) com os comunicados como linhas separadas por `var(--cor-borda)`. Cada linha, clicável inteira (com `role="button"`, `tabIndex={0}` e Enter/Espaço):
   - à esquerda, um avatar redondo de 40 px com as iniciais do autor (cores alternando entre as quatro do tema pela posição, usando os pares `--cor-*-suave` e `--cor-*`);
   - no meio, o título (peso 700 se não lido, 600 se lido; uma linha com reticências), abaixo o começo do corpo (uma linha, texto suave) e uma linha com o autor e um `Selo` pequeno do público ("Toda a escola", "Alunos", "Professores", "Turma {código}", "Curso {nome}");
   - à direita, o tempo relativo ("agora", "há 5 min", "há 2 h", "há 3 dias"; acima de 30 dias, a data) e, se não lido, um ponto azul;
   - a linha selecionada fica com fundo `var(--cor-primaria-suave)`.
   - Sem botões "Abrir" e "Excluir" na linha.
4. **Leitura** (coluna direita ou `Modal`): avatar, autor, data e hora completas, `Selo` do público, o título grande e o corpo com as quebras de linha preservadas (`white-space: pre-wrap`); no rodapé, quando o usuário pode excluir (administrador, ou o autor), o botão "Excluir" em estilo texto na cor de perigo, com `window.confirm`. Ao abrir um comunicado não lido, chame `POST /comunicados/:id/ler` e atualize a lista. Sem nada selecionado (em telas largas), a coluna da direita mostra um estado vazio com o ícone `comunicados` e "Selecione um comunicado para ler".
5. **Estados**: carregando, erro (`Aviso`), e vazio ("Nenhum comunicado por aqui." ou "Nenhum comunicado com esses filtros.").
6. **Formulário** de novo comunicado: continua em `Modal`; só confira o espaçamento e a ordem dos campos (título, público, turma ou curso conforme o público, corpo, botões à direita).
7. Rode a verificação.

## Critérios de aceite

- A tela deixa de ter botões grandes em cada comunicado; a lista é compacta, com avatar, prévia, público, tempo e marca de não lido.
- Abrir um comunicado o marca como lido e o contador de "Não lidos" diminui.
- Excluir continua funcionando para quem pode, a partir da leitura.
- Professor continua podendo publicar só para as turmas dele; aluno só lê.
- Nenhuma cor fixa em `comunicados.css`; em 360 px a lista ocupa a largura e a leitura abre em tela cheia; nada estoura.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos.

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
