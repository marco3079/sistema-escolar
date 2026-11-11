# Mini-plano g06: ficha do aluno e do professor, e menu de ações nas listas

## Objetivo

Pedido do usuário, com um print da lista de alunos e uma seta apontando para o fim da linha: "cria um botão dropdown com várias opções e quando clicar no aluno abre um popup com a ficha do aluno, tipo um mini dashboard sobre aquele aluno mostrando tudo sobre ele, e faz a mesma coisa nos professores".

Então, nas telas `/admin/alunos` e `/admin/professores`:
1. cada linha ganha, na última coluna (depois de "Situação"), um botão de menu suspenso com várias ações;
2. clicar na linha abre um **popup com a ficha** da pessoa, um mini painel com indicadores e tudo o que o sistema sabe sobre ela (hoje o clique abre o formulário de edição).

Leia antes: `docs/plano/i-g05-fichas-api.md` (formato exato de `GET /alunos/:id/ficha` e `GET /professores/:id/ficha`; o g05 está implementando), `client/src/modules/cadastros/alunos.tsx`, `professores.tsx`, `tipos.ts`, `client/src/ui/index.tsx` (principalmente `Tabela`, `Modal`, `Selo`, `Abas`, `Botao`), `client/src/ui/icones.tsx`, `client/src/layout/painel.css` (para repetir o estilo dos cartões de indicador) e `client/src/layout/MenuUsuario.tsx` (exemplo de menu suspenso que fecha com Escape e clique fora). Abra também a referência `.claude/referencias/exemplo.png` para seguir o estilo.

## Arquivos que você pode criar ou editar (e só estes)

- `client/src/modules/cadastros/alunos.tsx` (editar)
- `client/src/modules/cadastros/professores.tsx` (editar)
- `client/src/modules/cadastros/tipos.ts` (acrescentar os tipos das fichas)
- `client/src/modules/cadastros/MenuAcoes.tsx` (novo)
- `client/src/modules/cadastros/FichaAluno.tsx` (novo)
- `client/src/modules/cadastros/FichaProfessor.tsx` (novo)
- `client/src/modules/cadastros/FichaComum.tsx` (novo: peças usadas pelas duas fichas)
- `client/src/modules/cadastros/fichas.css` (novo)

Não edite `client/src/ui/index.tsx`, `estilo.css`, `client/src/modules/cadastros/index.tsx`, `perfil.tsx` nem `usuarios.tsx`.

## Regras gerais

- Classes novas com prefixo `ficha-` ou `acoes-`. Cores, raios e sombras só pelas variáveis de `client/src/ui/estilo.css` (`var(--cor-superficie)`, `var(--cor-borda)`, `var(--raio)`, `var(--sombra)`, `var(--cor-primaria)`, `var(--cor-primaria-suave)`, `var(--cor-roxo)` e `--cor-roxo-suave`, `var(--cor-verde)` e `--cor-verde-suave`, `var(--cor-laranja)` e `--cor-laranja-suave`, `var(--cor-sobre-primaria)`...). Nenhuma cor fixa, salvo `rgba` em sombra e no fundo escurecido.
- Ícones só com `<Icone nome="..." />` e nomes que existem em `NomeIcone`.
- Tudo funciona em 360 px de largura e nos temas claro e escuro.

## Passos

### 1. `MenuAcoes.tsx`

```tsx
export interface AcaoMenu { rotulo: string; icone?: NomeIcone; perigo?: boolean; aoClicar: () => void }
export function MenuAcoes({ acoes, rotulo }: { acoes: AcaoMenu[]; rotulo: string }): JSX.Element
```
- Um botão redondo de 36 px com o ícone `mais` (três pontos), `aria-label={rotulo}`, `aria-haspopup="menu"` e `aria-expanded`.
- O clique no botão faz `e.stopPropagation()` (para não disparar o clique da linha) e abre o menu; `onClick` no contêiner também para a propagação.
- O menu (`role="menu"`) abre abaixo do botão, alinhado à direita, com `position: absolute`, `z-index: 30`, fundo `var(--cor-superficie)`, borda, raio `var(--raio-pequeno)` e sombra; itens `role="menuitem"` com ícone e rótulo, altura mínima de 40 px; item com `perigo` em `var(--cor-perigo)`.
- Fecha ao escolher um item, com `Escape` e ao clicar fora (listeners registrados só enquanto aberto e removidos no retorno do efeito).
- O contêiner da tabela tem `overflow-x: auto`, o que cortaria um menu absoluto nas últimas linhas. Para não ser cortado, abra o menu com `position: fixed`, calculando `top` e `right` a partir de `getBoundingClientRect()` do botão no momento de abrir (e abrindo para cima quando faltar espaço embaixo), e feche ao rolar a página ou redimensionar a janela.

### 2. Listas (`alunos.tsx` e `professores.tsx`)

- Nova última coluna, com título vazio, contendo `<MenuAcoes rotulo={"Ações de " + nome} acoes={...} />`.
- `aoClicarLinha` passa a abrir a **ficha** (estado `ficha: number | null` com o id), não mais a edição.
- Ações do aluno: "Ver ficha" (`perfil`), "Editar cadastro" (`lapis`), "Matrículas" (`matriculas`, navega para `/admin/matriculas`), "Boletim e histórico" (`boletim`, navega para `/admin/boletins`), "Financeiro" (`financeiro`, navega para `/admin/financeiro`), e, por último, "Desativar" (`fechar`, `perigo`, com `window.confirm`, chama `DELETE /alunos/:id` e recarrega) quando o aluno está ativo, ou "Reativar" (`perfil`) quando está inativo. "Reativar" só aparece para o perfil ADMIN e chama `PUT /usuarios/{usuarioId}` com `{ ativo: true }`.
- Ações do professor: "Ver ficha", "Editar cadastro", "Turmas" (`turmas`, `/admin/turmas`), "Horários" (`horarios`, `/admin/horarios`), "Pós-graduação" (`pos`, `/admin/pos`), e "Desativar" / "Reativar" com a mesma regra (`DELETE /professores/:id`).
- O formulário de edição que já existe continua igual, aberto pela ação "Editar cadastro" e pelo botão "Editar" dentro da ficha.
- Mostre erros da API em `<Aviso tipo="erro">`.

### 3. `FichaComum.tsx`

Peças reutilizadas:
- `FichaModal({ aberto, titulo, aoFechar, children })`: popup próprio (o `Modal` de `ui` tem largura fixa de 560 px e não serve): fundo escurecido que fecha ao clicar, caixa centralizada com largura máxima de 980 px e altura máxima de 90vh com rolagem interna, `role="dialog"`, `aria-modal`, `aria-label`, botão de fechar com o ícone `fechar` e `aria-label="Fechar"`, fecha com `Escape`; abaixo de 720 px ocupa a tela toda.
- `FichaIndicador({ icone, cor, valor, rotulo })`: cartão pequeno com o quadrado colorido do ícone (cores `azul`, `roxo`, `verde`, `laranja`, como os indicadores do painel), o valor em destaque e o rótulo.
- `FichaSecao({ titulo, icone, children })`: bloco com título e ícone.
- `FichaLinha({ rotulo, valor })`: par "rótulo: valor"; valor vazio ou nulo vira "—".
- Funções de formatação que faltarem (nota com uma casa e vírgula, percentual).

### 4. `FichaAluno.tsx`

`export function FichaAluno({ alunoId, aoFechar, aoEditar }: { alunoId: number; aoFechar: () => void; aoEditar: () => void })`.
- Busca `GET /alunos/{id}/ficha` com `useDados`. Enquanto carrega, `<Carregando />`; em erro, `<Aviso tipo="erro">`.
- **Cabeçalho**: avatar redondo de 64 px com as iniciais (fundo `var(--gradiente-primario)`, texto `var(--cor-sobre-primaria)`), nome grande, "RA {ra} · {idade} anos", um `Selo` de situação (Ativo verde, Inativo cinza) e, à direita, os botões "Editar" (chama `aoEditar`) e "Fechar".
- **Indicadores** (grade de 3 colunas em tela larga, 2 em média, 1 em 360 px): Disciplinas cursando (azul, `biblioteca`), Média geral (roxo, `boletim`; "—" se nulo), Frequência média (verde, `grafico`; com "%"), Mensalidades em aberto (laranja, `financeiro`; valor = quantidade, e abaixo o total com `formatarMoeda`), Empréstimos ativos (azul, `diario`).
- **Corpo em duas colunas** (uma coluna abaixo de 900 px):
  - esquerda: seção "Dados pessoais" (e-mail, telefone, CPF, nascimento com `formatarData`, endereço, cadastrado em); seção "Responsável" (nome, telefone, e-mail; a seção inteira some se os três forem vazios); seção "Matrículas" (cada uma: curso, nível com `rotuloNivel`, série ou "Por créditos", ingresso, status em `Selo`);
  - direita: seção "Disciplinas" (lista com disciplina, turma, período, professor, nota, frequência e status em `Selo`; se houver mais de 8, mostre as 8 primeiras e um botão "Ver todas"); seção "Mensalidades" (competência, vencimento, valor, status em `Selo`; some se a lista vier vazia); seção "Biblioteca" (livro, retirada, devolução prevista, situação "Devolvido", "No prazo" ou "Atrasado"; some se vazia); seção "Pesquisa" (título, status, orientador; some se `projeto` for nulo).
- Rodapé com atalhos: "Ver boletim" (`/admin/boletins`), "Matrículas" (`/admin/matriculas`), "Financeiro" (`/admin/financeiro`), como `Link`.

### 5. `FichaProfessor.tsx`

`export function FichaProfessor({ professorId, aoFechar, aoEditar })`. Busca `GET /professores/{id}/ficha`.
- **Cabeçalho**: avatar com iniciais, nome, "Registro {registro} · {titulação em português}" (GRADUADO "Graduado", ESPECIALISTA "Especialista", MESTRE "Mestre", DOUTOR "Doutor"), área, `Selo` de situação, botões "Editar" e "Fechar".
- **Indicadores**: Turmas ativas (azul, `turmas`), Alunos (roxo, `alunos`), Orientações (verde, `pos`), Carga semanal (laranja, `horarios`; "{n} h"), Média das turmas (azul, `boletim`), Frequência média (verde, `grafico`).
- **Corpo em duas colunas**:
  - esquerda: "Dados pessoais" (e-mail, telefone, CPF, cadastrado em); "Horário semanal" (lista agrupada por dia da semana: "Segunda-feira" ... com hora, disciplina, turma e sala; "Sem horários cadastrados" se vazio);
  - direita: "Turmas" (código, disciplina, curso, período, inscritos/vagas; as de período encerrado com `Selo` cinza "Encerrada"); "Orientações" (título, aluno, curso, papel, status; some se vazia); "Bancas" (tipo, data, projeto, papel, resultado; some se vazia); "Biblioteca" (some se vazia).
- Rodapé com atalhos: "Turmas" (`/admin/turmas`), "Horários" (`/admin/horarios`), "Pós-graduação" (`/admin/pos`).

### 6. `tipos.ts`

Acrescente `FichaAlunoDTO` e `FichaProfessorDTO`, campo a campo iguais ao contrato de `docs/plano/i-g05-fichas-api.md`.

### 7. Rótulos de status (em português, com `Selo`)

Matrícula: ATIVA "Ativa" (verde), TRANCADA "Trancada" (amarelo), CONCLUIDA "Concluída" (azul), CANCELADA "Cancelada" (cinza). Inscrição: CURSANDO "Cursando" (azul), APROVADO "Aprovado" (verde), REPROVADO_NOTA "Reprovado por nota" (vermelho), REPROVADO_FALTA "Reprovado por falta" (vermelho), TRANCADO "Trancado" (cinza). Mensalidade: ABERTA "Em aberto" (azul), PAGA "Paga" (verde), ATRASADA "Atrasada" (vermelho), CANCELADA "Cancelada" (cinza). Projeto: EM_ELABORACAO "Em elaboração" (cinza), QUALIFICADO "Qualificado" (azul), APROVADO "Aprovado" (verde), REPROVADO "Reprovado" (vermelho). Banca: QUALIFICACAO "Qualificação", DEFESA "Defesa"; resultado PENDENTE "Pendente", APROVADO "Aprovado", APROVADO_COM_RESSALVAS "Aprovado com ressalvas", REPROVADO "Reprovado".

## Critérios de aceite

- Clicar numa linha de aluno ou de professor abre a ficha; o menu de três pontos abre sem abrir a ficha.
- O menu não é cortado pela tabela, fecha com Escape, clique fora e rolagem, e é utilizável pelo teclado (Tab até o botão, Enter abre, Tab pelos itens).
- A ficha mostra todos os blocos do contrato, some com as seções vazias, e fecha com Escape, clique fora e botão.
- Editar, desativar e reativar continuam funcionando e recarregam a lista.
- Nenhuma cor fixa em `fichas.css`; nada estoura em 360 px.
- `cd client && npx tsc --noEmit` com zero erro.

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
