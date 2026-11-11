# Mini-plano g21: telas do fórum

## Objetivo

O usuário pediu "um fórum para os alunos e professores poderem publicar e responder as publicações", com o layout "muito parecido com o do Reddit". Entregue a mesma **estrutura** de um fórum com votos, com a identidade visual do próprio sistema: coluna central de publicações, cada uma com a coluna de votos à esquerda; barra de ordenação; barra lateral com as comunidades; página da publicação com comentários em árvore. Não copie nome, logotipo, textos, ícones nem cores de outro produto: use os componentes, as cores e os ícones daqui.

Leia antes: `docs/plano/terceira-leva.md` (seção "Fórum": endpoints, `ComunidadeDTO`, `PublicacaoDTO`, `ComentarioDTO` e regras; o g17 está implementando o servidor), `client/src/lib/api.ts`, `client/src/lib/useDados.ts`, `client/src/lib/auth.tsx`, `client/src/lib/rotas.ts`, `client/src/App.tsx` (como rotas com parâmetro e `menu: false` são registradas), `client/src/ui/index.tsx` (o g18 está acrescentando `Avatar` e exportando `MenuAcoes`), `client/src/ui/estilo.css` (classes `barra-ferramentas`, `segmentado`), `client/src/ui/icones.tsx` e `client/src/modules/biblioteca/CampoCapa.tsx` (exemplo de redução de imagem por canvas). Abra a referência `.claude/referencias/exemplo.png` para seguir o estilo do sistema.

## Arquivos que você pode criar (e só estes)

Todos em `client/src/modules/forum/`: `index.tsx` (exporta `rotas`), `Feed.tsx`, `CartaoPublicacao.tsx`, `Votos.tsx`, `PaginaPublicacao.tsx`, `Comentarios.tsx`, `NovaPublicacao.tsx`, `BarraLateral.tsx`, `comum.tsx`, `forum.css`.

## Regras gerais

- Classes com prefixo `forum-`. Cores, raios e sombras só por variáveis de `client/src/ui/estilo.css`. Voto para cima ativo em `var(--cor-laranja)`; voto para baixo ativo em `var(--cor-primaria)`.
- O fórum existe nos três portais. O prefixo da rota vem do portal do usuário (`/admin`, `/professor` ou `/aluno`); escreva um auxiliar `baseForum(perfil)` em `comum.tsx` e use-o em todos os links.
- Voto otimista: ao clicar, atualize os pontos e o estado na hora e desfaça se a API falhar.

## Passos

1. **`index.tsx`**: para cada portal, as rotas `{base}/forum` (rótulo "Fórum", ícone `forum`, ordem 80, no menu), `{base}/forum/c/:slug` e `{base}/forum/p/:id` (`menu: false`). Perfis: `/admin` = `['ADMIN', 'SECRETARIA']`, `/professor` = `['PROFESSOR']`, `/aluno` = `['ALUNO']`.
2. **`Votos.tsx`**: `Votos({ pontos, meuVoto, aoVotar, orientacao })`: botão `voto-cima`, o número de pontos (formato compacto: "1,2 mil" acima de 999) e botão `voto-baixo`, em coluna (padrão) ou em linha; `aria-label` "Votar a favor" e "Votar contra", `aria-pressed`. Clicar no voto já dado remove o voto (envia 0).
3. **`CartaoPublicacao.tsx`**: cartão com a coluna de votos à esquerda (em linha, embaixo, no celular) e, à direita: a linha de contexto (bolinha colorida da comunidade com o nome como link, "publicado por {autor}", `Selo` do papel quando for professor ou equipe, tempo relativo, marca "Fixada" com o ícone `fixar` e "Fechada" com `cadeado`), o título (link para a publicação), o começo do corpo (até 3 linhas, com reticências), a miniatura da imagem (se houver) e a barra de ações (ícone `comentario` com "{n} comentários", e um `MenuAcoes` com "Editar" e "Excluir" conforme `posso`, e "Fixar/Desafixar" e "Fechar/Reabrir comentários" para quem modera).
4. **`Feed.tsx`** (rotas `{base}/forum` e `{base}/forum/c/:slug`): layout em duas colunas a partir de 1000 px (feed com largura máxima de 760 px e barra lateral de 300 px); abaixo disso, só o feed, com as comunidades num seletor no topo.
   - Cabeçalho: no feed geral, "Fórum" e uma frase; numa comunidade, a faixa da comunidade (cor, nome, descrição, quantidade de publicações).
   - Barra: uma caixa "Criar publicação" (avatar e um campo falso que abre o `NovaPublicacao`), o controle segmentado de ordenação ("Em alta", "Novas", "Mais votadas") e a busca.
   - Lista de `CartaoPublicacao` de `GET /forum/publicacoes` (com `comunidade`, `ordem`, `busca`); "Carregar mais" quando `haMais` (usa `antesDe`); estados de carregando, erro e vazio ("Nenhuma publicação ainda. Seja a primeira pessoa a publicar.").
5. **`BarraLateral.tsx`**: cartão "Comunidades" (lista de `GET /forum/comunidades`, com a bolinha colorida, o nome e a quantidade; a atual destacada; link "Todas"), botão "Criar comunidade" para ADMIN, SECRETARIA e PROFESSOR (`Modal` com nome, descrição e cor; `POST /forum/comunidades`) e um cartão "Regras de convivência" com três frases curtas (respeito, sem dados pessoais de terceiros, dúvidas de disciplina na comunidade certa).
6. **`NovaPublicacao.tsx`**: `Modal` com comunidade (`Selecao`, já preenchida quando aberta dentro de uma comunidade), título, texto (`AreaTexto`) e imagem opcional (reduzida no `<canvas>` para até 1000 px de largura, JPEG 0.8, até 190.000 caracteres; prévia com opção de remover). `POST /forum/publicacoes`; no sucesso, navega para a publicação criada. O mesmo componente serve para editar (`PUT`).
7. **`PaginaPublicacao.tsx`** (rota `{base}/forum/p/:id`): link "Voltar" para o feed da comunidade; a publicação inteira (votos, contexto, título, corpo com quebras de linha, imagem em tamanho maior, ações); a caixa "Escreva um comentário" (some com aviso quando a publicação está fechada); e os comentários.
8. **`Comentarios.tsx`**: monte a árvore a partir da lista plana (`paiId`) e desenhe com recuo e uma linha vertical por nível (a linha, clicável, recolhe e expande o ramo); cada comentário com `Avatar`, autor, papel, tempo, texto, `Votos` em linha, "Responder" (abre uma caixa de resposta logo abaixo) e as ações de editar e excluir conforme `posso`. Limite o recuo a 6 níveis (a partir daí, sem recuo extra). Ordenação: mais votados primeiro em cada nível. Comentário removido aparece como "[comentário removido]", sem ações, mantendo as respostas.
9. Rode a verificação.

## Critérios de aceite

- Alunos e professores publicam, votam, comentam e respondem comentários; a árvore de comentários funciona, com recolher e expandir.
- Ordenações, busca, comunidades e "Carregar mais" funcionam; quem modera consegue fixar, fechar e excluir.
- Voto otimista com reversão em erro; um clique no voto já dado o remove.
- Estrutura de fórum com votos, com a identidade visual do sistema; nenhum nome, logotipo ou texto de outro produto.
- Nenhuma cor fixa em `forum.css`; em 360 px o feed ocupa a largura e nada estoura.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos (se o erro for de `Avatar`, `MenuAcoes` ou ícone novo ainda não gravado pelo g18, espere a nota dele na sala e rode de novo).

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
