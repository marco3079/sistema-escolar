# Mini-plano g11: Biblioteca com capas e alternância entre tabela e cartões

## Objetivo

Pedido do usuário, com um print do Acervo: "aqui coloca a imagem do livro em miniatura e deixa a possibilidade de trocar de tabela para card". Pelo popup: a imagem pode ser enviada do computador ou informada por endereço (as duas formas).

Leia antes: `docs/plano/segunda-leva.md` (seção "Usuários e livros": regra do campo `capa`), `server/prisma/schema.prisma` (modelo `Livro`, que já tem `capa String?`), `server/src/modules/biblioteca/routes.ts`, `client/src/modules/biblioteca/index.tsx` inteiro, `client/src/ui/index.tsx`, `client/src/ui/estilo.css` (classes utilitárias `barra-ferramentas` e `filtros`, no fim do arquivo) e `client/src/ui/icones.tsx`. Abra a referência `.claude/referencias/exemplo.png` para seguir o estilo.

## Arquivos que você pode criar ou editar (e só estes)

- `server/src/modules/biblioteca/routes.ts`
- `client/src/modules/biblioteca/index.tsx`
- `client/src/modules/biblioteca/CapaLivro.tsx` (novo)
- `client/src/modules/biblioteca/CampoCapa.tsx` (novo)
- `client/src/modules/biblioteca/biblioteca.css` (novo)
- outros arquivos novos nessa pasta, se quiser dividir o `index.tsx`

## Passos do servidor

1. `POST /livros` e `PUT /livros/:id` aceitam `capa` opcional (`string | null`). Validação com zod: `null` ou string que (a) começa com `http://` ou `https://` e tem até 500 caracteres, ou (b) começa com `data:image/jpeg;base64,`, `data:image/png;base64,` ou `data:image/webp;base64,` e tem até 200.000 caracteres. Fora disso, 400 "Capa inválida". String vazia vira `null`.
2. `GET /livros` e as respostas de criar e editar devolvem `capa`. As respostas de empréstimos (`EmprestimoDTO`) passam a incluir `capa` dentro de `livro` (`livro: { id, titulo, autor, capa }`).
3. Nada mais muda no servidor.

## Passos do cliente

1. **`CapaLivro.tsx`**: `export function CapaLivro({ livro, tamanho }: { livro: { titulo: string; categoria?: string | null; capa?: string | null }; tamanho: 'mini' | 'media' | 'grande' })`.
   - Proporção de capa (2:3): mini 40 x 60 px, media 96 x 144 px, grande 100% da largura do cartão com `aspect-ratio: 2 / 3`. Cantos de 6 px, sombra leve.
   - Com `capa`: `<img src={capa} alt="" loading="lazy">` com `object-fit: cover`; se a imagem falhar (`onError`), cai para a capa gerada.
   - Sem `capa` (ou com erro): capa gerada: fundo com uma das quatro cores do tema escolhida por um cálculo estável sobre a categoria ou o título (classes `biblioteca-capa-azul`, `-roxo`, `-verde`, `-laranja`, usando `var(--cor-primaria)`, `var(--cor-roxo)`, `var(--cor-verde)`, `var(--cor-laranja)`), uma faixa de "lombada" mais escura à esquerda (com `color-mix`), as iniciais do título (até 2 letras) em destaque e, nos tamanhos media e grande, o título em até 3 linhas; texto em `var(--cor-sobre-primaria)`.
2. **`CampoCapa.tsx`**: campo do formulário de livro: mostra a prévia (`CapaLivro` media) e duas formas de definir a capa:
   - "Enviar imagem": `<input type="file" accept="image/png,image/jpeg,image/webp">` (com `<label>` estilizado como botão secundário); ao escolher, leia o arquivo, desenhe num `<canvas>` reduzindo para no máximo 360 px de altura (mantendo a proporção) e exporte com `canvas.toDataURL('image/jpeg', 0.82)`; se o resultado passar de 190.000 caracteres, reduza a qualidade (0.7, depois 0.55) e, em último caso, a altura (240 px); se ainda passar, mostre "Imagem grande demais";
   - "Ou cole um endereço": `Campo` de texto para `https://...`;
   - botão "Remover capa". O componente recebe `valor: string | null` e `aoMudar(valor: string | null)`.
3. **Formulário de livro**: acrescente o `CampoCapa` e envie `capa` em `POST` e `PUT`.
4. **Alternância de visão** no Acervo (administrativo, professor e aluno): um controle segmentado com dois botões de ícone, "Tabela" (`lista`) e "Cartões" (`grade`), com `aria-pressed`; a escolha fica guardada em `localStorage` na chave `escola.biblioteca.visao` (leitura e escrita dentro de `try/catch`; padrão `tabela` em telas de 720 px ou mais e `cartoes` abaixo disso). Os ícones `lista` e `grade` estão sendo criados agora pelo g09; se ainda não existirem ao compilar, espere o `done` dele na sala.
   - **Tabela**: a primeira coluna passa a ter a miniatura (`CapaLivro` mini) ao lado do título (título em peso 600 e, embaixo, o autor em texto suave); as demais colunas continuam (categoria, ano, disponíveis); a coluna de ações usa botões pequenos (`Botao` texto para "Editar" e "Excluir" com a cor de perigo, sem o botão vermelho cheio).
   - **Cartões**: grade responsiva (`repeat(auto-fill, minmax(170px, 1fr))`, 2 colunas em 360 px); cada cartão com a capa grande, título (2 linhas com reticências), autor, categoria e ano em texto suave, um `Selo` de disponibilidade ("{d} de {e} disponíveis": verde se houver, vermelho se zero) e, no administrativo, as ações "Editar" e "Excluir".
5. **Barra de ferramentas** do Acervo e de Empréstimos: use `<div className="barra-ferramentas"><div className="filtros">...</div>...ações...</div>` (busca à esquerda; o alternador de visão e o botão "Novo livro" ou "Novo empréstimo" à direita), no lugar do botão solto seguido do campo em largura total.
6. **Empréstimos** e **Meus empréstimos**: mostre a miniatura do livro ao lado do título.
7. Rode a verificação.

## Critérios de aceite

- Livro com capa enviada, com capa por endereço e sem capa aparecem corretamente nas duas visões; imagem quebrada cai para a capa gerada.
- A visão escolhida persiste ao recarregar a página.
- O servidor recusa capa fora do formato ou do tamanho (400).
- Nenhuma cor fixa em `biblioteca.css`; nada estoura em 360 px.
- `npx tsc --noEmit` em `server` e em `client` sem erro nos SEUS arquivos.

## Verificação

```
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
