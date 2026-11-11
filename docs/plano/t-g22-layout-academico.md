# Mini-plano g22: layout de Cursos, Períodos letivos e Turmas

## Objetivo

O usuário pediu "melhora o layout da tela de Turmas", "de Cursos também", e mandou um print de Períodos letivos marcando o vazio à direita da coluna de ações (os links "Editar" e "Desativar" ficam soltos no meio da linha, com a tabela terminando num espaço morto).

Leia antes: `client/src/modules/academico/cursos.tsx`, `periodos.tsx`, `turmas.tsx`, `tipos.ts`, `comum.ts`; `client/src/ui/index.tsx` (o g18 está acrescentando em `ColunaTabela` as props `alinhar` e `acoes`, o componente `Avatar` e a exportação de `MenuAcoes` com o tipo `AcaoMenu`); `client/src/ui/estilo.css` (classes utilitárias `barra-ferramentas`, `filtros`, `resumo`, `resumo-item`, `segmentado`); `client/src/ui/icones.tsx`; `client/src/modules/biblioteca/index.tsx` (exemplo recente de alternância entre tabela e cartões). Abra a referência `.claude/referencias/exemplo.png` para seguir o estilo.

## Arquivos que você pode editar (e só estes)

- `client/src/modules/academico/cursos.tsx`
- `client/src/modules/academico/periodos.tsx`
- `client/src/modules/academico/turmas.tsx`
- `client/src/modules/academico/academico.css` (novo; importado pelos três)
- `client/src/modules/academico/comum.ts` e `tipos.ts` (só se precisar de um auxiliar)

Não mude chamadas à API, regras nem textos de formulário. É um passe de layout.

## Regras gerais

- Classes novas com prefixo `academico-`. Cores, raios e sombras só por variáveis de `client/src/ui/estilo.css`.
- **Coluna de ações em todas as tabelas**: última coluna com `acoes: true` e um `<MenuAcoes rotulo="Ações de ..." acoes={[...]} />` (três pontos) no lugar dos links ou botões soltos; ação destrutiva com `perigo: true`. Assim a coluna fica estreita e encostada à direita, sem espaço morto.
- Barra de ferramentas (`barra-ferramentas` com `filtros`) no topo de cada tela: busca e filtros à esquerda, alternador de visão e botão de criar à direita.

## Passos

### 1. Períodos letivos

- Fileira de resumo (`resumo` com `resumo-item`): "Períodos ativos", "Encerrados" e "Período atual" (o ativo que contém a data de hoje; "—" se não houver).
- Tabela: Nome (peso 600), Ano, Tipo (`Selo` azul para Anual, roxo para Semestral), Início, Fim, uma coluna **"Andamento"** com uma barrinha de progresso entre início e fim (percentual do período já decorrido; 0% antes de começar, 100% depois de terminar) e o texto "{n}%", Situação (`Selo`) e a coluna de ações com o menu ("Editar", "Desativar" ou "Ativar").
- Clicar na linha abre a edição.

### 2. Cursos

- Barra: busca por nome ou código (filtra no cliente), filtro por nível (já existe) e o alternador **Cartões | Tabela** (`segmentado`, ícones `grade` e `lista`, `aria-pressed`; guarde a escolha em `localStorage` na chave `escola.cursos.visao`, com `try/catch`; padrão `cartoes`).
- **Cartões**: grade (`repeat(auto-fill, minmax(280px, 1fr))`); cada curso num cartão com uma faixa colorida no topo conforme o nível (use as quatro cores do tema, repetindo), o `Selo` do nível, o nome (peso 700), o código em texto suave e três dados em linha (duração em séries ou semestres, carga horária, mensalidade com `formatarMoeda`), a quantidade de disciplinas (se o dado estiver disponível na lista; senão omita), o `Selo` de situação e o menu de ações ("Ver disciplinas", "Editar", "Desativar"). Clicar no cartão abre o detalhe do curso (como hoje).
- **Tabela**: as colunas atuais, com o código em fonte monoespaçada pequena, mensalidade alinhada à direita (`alinhar: 'direita'`), e a coluna de ações com o menu.
- Detalhe do curso (o popup com as disciplinas por período): cada período sugerido vira um bloco com título ("1ª série" ou "1º semestre", conforme o regime) e as disciplinas em linhas compactas (código, nome, carga horária, créditos, pré-requisitos como `Selo` pequenos, e o menu de ações com "Editar" e "Excluir"); botão "Nova disciplina" no topo do popup.

### 3. Turmas

- Fileira de resumo: "Turmas" (total filtrado), "Alunos inscritos" (soma), "Ocupação média" (inscritos / vagas, em %) e "Sem vagas" (quantas estão lotadas).
- Barra: filtros de período e curso (já existem, na `barra-ferramentas` que o g12 montou), busca por código ou disciplina (cliente), o alternador **Tabela | Cartões** (`escola.turmas.visao`, padrão `tabela`) e o botão "Nova turma".
- **Tabela**: Código (monoespaçado), Disciplina (peso 600, com o curso em texto suave embaixo), Professor (com `Avatar` pequeno de iniciais), Período, Grupo, Sala, e **Ocupação**: uma barrinha de progresso com "{inscritos}/{vagas}" (verde até 70%, laranja até 99%, vermelha quando lotada, por classes com variáveis), e a coluna de ações com o menu ("Editar", "Excluir").
- **Cartões**: disciplina em destaque, código, curso, professor com avatar, período, sala e a barra de ocupação.

### 4. Rode a verificação.

## Critérios de aceite

- Nas três telas, a coluna de ações é um menu de três pontos encostado à direita; não sobra espaço morto depois dela.
- Períodos com resumo e barra de andamento; Cursos com cartões e tabela alternáveis; Turmas com resumo, ocupação visual e alternância.
- Nenhuma regra de negócio, chamada à API ou texto de formulário alterado (o `git diff` mostra só layout).
- Nenhuma cor fixa em `academico.css`; nada estoura em 360 px; legível nos dois temas.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos (se o erro for de `MenuAcoes`, `Avatar`, `acoes`/`alinhar` ou ícone ainda não gravado pelo g18, espere a nota dele na sala e rode de novo).

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
