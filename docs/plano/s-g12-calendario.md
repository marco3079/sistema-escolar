# Mini-plano g12: Calendário com cara de calendário, e filtros de Horários e Turmas

## Objetivo

O usuário mandou um print da tela Calendário (`/admin/calendario`) dizendo "nessa parte o layout está bem feio": hoje é uma lista crua de eventos agrupada por mês, com dois botões grandes ("Editar" e "Excluir" vermelho) em cada linha. Refaça como um calendário de verdade.

De passagem, arrume os filtros empilhados em largura total nas telas de Horários e de Turmas (mesmo defeito que o usuário apontou no Financeiro).

Leia antes: `client/src/modules/agenda/Calendario.tsx`, `FormularioEvento.tsx`, `agenda.css`, `index.tsx`, `tipos.ts`; `client/src/modules/academico/turmas.tsx`; `client/src/ui/index.tsx`; `client/src/ui/estilo.css` (classes utilitárias `barra-ferramentas` e `filtros`, no fim); `client/src/ui/icones.tsx`. Abra a referência `.claude/referencias/exemplo.png` para seguir o estilo (cartões, cantos, cores).

## Arquivos que você pode editar (e só estes)

- `client/src/modules/agenda/Calendario.tsx`
- `client/src/modules/agenda/agenda.css`
- `client/src/modules/agenda/FormularioEvento.tsx` (só se o formulário precisar de ajuste)
- `client/src/modules/agenda/index.tsx`
- `client/src/modules/academico/turmas.tsx` (só o bloco dos filtros)
- arquivos novos dentro de `client/src/modules/agenda/`, se quiser dividir

O componente `Calendario` continua com a mesma assinatura (inclusive a prop `editavel`) e servindo às três telas (`/admin/calendario`, `/professor/calendario`, `/aluno/calendario`). A API não muda (`GET /calendario`, `POST`, `PUT`, `DELETE`).

## Passos

### 1. Calendário

- **Cabeçalho da tela**: título do mês e ano por extenso ("Novembro de 2026"), botões de ícone "mês anterior" e "próximo mês" (use `chevron-baixo` girado com CSS, ou `seta-direita` espelhada), botão "Hoje", um alternador "Mês | Lista" (controle segmentado com `aria-pressed`) e, quando `editavel`, o botão "Novo evento". Tudo numa `barra-ferramentas`.
- **Visão Mês** (padrão a partir de 720 px): grade de 7 colunas (Seg a Dom, com o nome do dia abreviado no topo) e de 5 ou 6 semanas, dentro de um cartão (`var(--cor-superficie)`, borda, raio, sombra). Cada célula mostra o número do dia (dias de outro mês em texto suave; hoje com o número dentro de um círculo `var(--cor-primaria)` e texto `var(--cor-sobre-primaria)`) e os eventos daquele dia como faixas pequenas coloridas pelo tipo (até 3 por dia; havendo mais, "+N"). Evento de vários dias aparece em todos os dias do intervalo. Célula com altura mínima de 96 px. Clicar numa faixa abre o detalhe do evento.
- **Visão Lista** (padrão abaixo de 720 px, e opção em telas largas): eventos do mês selecionado em cartões compactos, cada um com um bloco de data à esquerda (dia grande e mês abreviado em cima; para intervalo, "16-17"), o título em peso 700, o `Selo` do tipo, a descrição em texto suave (uma linha) e o período por extenso. Sem botões grandes na linha: o cartão inteiro é clicável e abre o detalhe.
- **Detalhe do evento** (`Modal`): título, tipo, datas, descrição; quando `editavel`, botões "Editar" (abre o formulário existente) e "Excluir" (com `window.confirm`).
- **Painel lateral "Próximos eventos"** (à direita da grade a partir de 1100 px; abaixo da grade em telas menores): os 5 próximos eventos a partir de hoje, no formato compacto da lista, e uma legenda dos tipos com as cores.
- **Cores por tipo** (classes `agenda-tipo-*` usando só variáveis): LETIVO azul (`--cor-primaria` e `--cor-azul-suave`), FERIADO vermelho (`--cor-perigo`, fundo com `color-mix`), PROVA laranja (`--cor-laranja` e `--cor-laranja-suave`), EVENTO verde (`--cor-verde` e `--cor-verde-suave`), RECESSO cinza (`--cor-texto-suave` e `--cor-superficie-2`).
- **Datas**: os eventos chegam como ISO. Datas gravadas sem hora vêm como meia-noite UTC e não podem deslocar um dia: para decidir em que dia do calendário um evento cai, leia ano, mês e dia direto dos 10 primeiros caracteres da string ISO quando a hora for `T00:00:00`; caso contrário, use a data local. Para "hoje" e para a navegação de meses, use a data local.
- **Busca dos dados**: `GET /calendario?de=AAAA-MM-01&ate=AAAA-MM-último` do mês exibido (com uma folga de 7 dias para cada lado, para as células de outros meses) e outra consulta para os próximos eventos (de hoje até 120 dias à frente).
- Semana começando na segunda-feira. Nomes de meses e dias em português.

### 2. Horários (`agenda/index.tsx`) e Turmas (`academico/turmas.tsx`)

- Onde hoje há `Selecao` e `Campo` de filtro empilhados em largura total (e o botão "Novo horário" ou "Nova turma" solto), use `<div className="barra-ferramentas"><div className="filtros">...</div>{botão}</div>`. Em Turmas, se os filtros estiverem dentro de um `Cartao`, tire o cartão. Não mude lógica nem textos.

### 3. Rode a verificação.

## Critérios de aceite

- A tela Calendário mostra a grade do mês com os eventos nos dias certos (um evento de 16/02 a 17/02 aparece nos dois dias; um de 02/02 aparece no dia 2, não no dia 1), navegação entre meses, "Hoje" e a alternância Mês/Lista.
- Sem botões "Editar" e "Excluir" em cada linha: as ações ficam no detalhe do evento.
- Professor e aluno veem o mesmo calendário, só leitura.
- Nenhuma cor fixa em `agenda.css`; em 360 px a visão Lista é a padrão e nada estoura.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos.

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
