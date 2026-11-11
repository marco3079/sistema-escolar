# Mini-plano g23: layout de Boletins, boletim e histórico do aluno

## Objetivo

O usuário pediu: "melhora o layout da tela de Boletins". Hoje a tela administrativa é um seletor de matrícula em largura total, abas e tabelas cruas; o boletim e o histórico do aluno usam os mesmos componentes. Refaça a apresentação, sem mudar dados nem regras.

Leia antes: `client/src/modules/diario/index.tsx` inteiro (principalmente `BoletimView`, `HistoricoView`, `BoletimAluno`, `HistoricoAluno` e `BoletinsAdmin`; as partes do diário do professor, `AbaNotas`, `AbaFrequencia`, `AbaFechamento` e `DiarioTurma`, **não são suas**), `client/src/modules/diario/diario.css`, `docs/plano/CONTRATOS.md` seção 5.5 (formatos `BoletimDTO` e `HistoricoDTO`), `client/src/ui/index.tsx` (o g18 está acrescentando `Avatar` e as props `alinhar` e `acoes` de `ColunaTabela`), `client/src/ui/estilo.css` (classes `barra-ferramentas`, `filtros`, `resumo`, `resumo-item`, `segmentado`) e `client/src/ui/icones.tsx`. Abra a referência `.claude/referencias/exemplo.png` para seguir o estilo.

## Arquivos que você pode criar ou editar (e só estes)

- `client/src/modules/diario/index.tsx`: **somente** as funções `BoletimView`, `HistoricoView`, `BoletimAluno`, `HistoricoAluno`, `BoletinsAdmin` e auxiliares que só elas usam. Se preferir, mova essas cinco para arquivos novos e deixe em `index.tsx` só os imports.
- `client/src/modules/diario/Boletim.tsx`, `Historico.tsx`, `BoletinsAdmin.tsx` (novos, opcionais)
- `client/src/modules/diario/boletim.css` (novo)

Não altere o diário do professor, as rotas exportadas (`rotas`), as chamadas à API nem os cálculos.

## Regras gerais

- Classes novas com prefixo `boletim-`. Cores, raios e sombras só por variáveis de `client/src/ui/estilo.css`.
- Cor da nota: verde (`--cor-sucesso`) quando a nota final é maior ou igual à média mínima, vermelha (`--cor-perigo`) quando menor, texto normal quando ainda não há nota. A média mínima não vem na API: use 7 para os níveis ESPECIALIZACAO, MESTRADO e DOUTORADO e 6 para os demais (o nível vem em `matricula.curso.nivel`). Frequência abaixo de 75% em vermelho.

## Passos

### 1. Cabeçalho do boletim e do histórico (usado nas três telas)

Cartão com `Avatar` do aluno (iniciais), nome em destaque, "RA {ra}", o curso, o `Selo` do nível e o status da matrícula; à direita, um botão "Imprimir" (`window.print()`) com o ícone `documento`.

### 2. `BoletimView`

- Fileira de resumo do período exibido (`resumo`): "Disciplinas", "Média do período" (média das notas finais não nulas), "Frequência média" e "Aprovadas" ("{a} de {n}").
- Se houver mais de um período, um controle segmentado ou um `Selecao` para escolher o período (o mais recente por padrão), no lugar de empilhar todos os períodos na tela.
- Cada disciplina vira um **cartão de disciplina** numa grade (`repeat(auto-fill, minmax(300px, 1fr))`): nome em destaque, código, turma e professor em texto suave; as avaliações em linhas ("Prova 1", peso, e a nota ou "—"); embaixo, dois medidores lado a lado: **Média** (número grande na cor da regra, com uma barra de 0 a 10 e um marcador na média mínima) e **Frequência** (percentual e barra, com marcador em 75%); e o `Selo` da situação no canto superior direito.
- Alternador **Cartões | Tabela** (`segmentado`; chave `escola.boletim.visao`; padrão `cartoes`). A visão Tabela mostra uma linha por disciplina (disciplina, uma coluna por avaliação quando couber ou as avaliações em texto, média, frequência e situação), com rolagem horizontal **dentro do cartão**, nunca na página.

### 3. `HistoricoView`

- Fileira de resumo: "Créditos concluídos", "Carga horária concluída" ("{n} h"), "Coeficiente" (2 casas) e "Disciplinas aprovadas".
- Disciplinas agrupadas por período (do mais recente para o mais antigo), cada grupo com o nome do período como título e uma tabela compacta (código monoespaçado, disciplina, carga horária, créditos, nota final na cor da regra, frequência e `Selo` da situação), com números alinhados à direita (`alinhar: 'direita'`).

### 4. `BoletinsAdmin` (tela `/admin/boletins`)

- Layout em duas colunas a partir de 1000 px: à esquerda (cerca de 340 px), a **lista de matrículas** num cartão, com busca por nome ou RA e filtro por curso; cada item com `Avatar`, nome, RA e curso, e o selecionado destacado com `var(--cor-primaria-suave)`. À direita, o cabeçalho do aluno e as `Abas` "Boletim" e "Histórico".
- Abaixo de 1000 px: a lista vira um `Selecao` (como hoje) dentro de uma `barra-ferramentas`, e o conteúdo vem embaixo.
- Sem matrícula escolhida: estado vazio com o ícone `boletim` e "Escolha um aluno para ver o boletim e o histórico."

### 5. `BoletimAluno` e `HistoricoAluno`

Usam o mesmo cabeçalho e os mesmos componentes; quando o aluno tem mais de uma matrícula, o seletor de matrícula fica numa `barra-ferramentas` no topo.

### 6. Impressão

Em `boletim.css`, um bloco `@media print` que esconde a casca do app (barra lateral, topo, barra inferior: seletores que começam com `.casca-`, exceto a área de conteúdo), os botões e os filtros, e imprime o cabeçalho, o resumo e as disciplinas em fundo branco com texto escuro.

### 7. Rode a verificação.

## Critérios de aceite

- A tela Boletins tem lista de alunos com busca à esquerda e o boletim à direita, com cabeçalho, resumo e cartões de disciplina com medidores de média e de frequência.
- O boletim e o histórico do aluno usam o mesmo padrão.
- Os números são os mesmos de antes (nenhum cálculo novo além das médias de resumo, feitas sobre os dados recebidos).
- O diário do professor não foi alterado (`git diff` restrito às cinco funções e aos arquivos novos).
- Nenhuma cor fixa em `boletim.css`, salvo o preto e o branco dentro de `@media print`; nada estoura em 360 px.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos (se o erro for de `Avatar`, `alinhar` ou ícone ainda não gravado pelo g18, espere a nota dele na sala e rode de novo).

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
