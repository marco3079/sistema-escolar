# Mini-plano g07: layout da tela Financeiro e espaçamento das páginas internas

## Objetivo

O usuário mandou um print da tela `/admin/financeiro` dizendo "o layout está estranho aqui". Os defeitos visíveis:

1. Nos quatro cartões de resumo, o rótulo e o valor estão na mesma linha e grudados ("Em abertoR$ 5.650,00").
2. As abas ("Mensalidades", "Bolsas") estão coladas nos cartões de resumo, sem espaço.
3. O botão "Gerar mensalidades" fica solto numa linha própria, à direita, com espaços desiguais em volta.
4. Os filtros ("Status", "Competência") ocupam a largura toda, um embaixo do outro.

Leia antes: `client/src/modules/financeiro/index.tsx` inteiro, `client/src/ui/estilo.css` inteiro, `client/src/ui/index.tsx` (componentes `Pagina`, `Cartao`, `Grade`, `Abas`, `Campo`, `Selecao`, `Botao`), `client/src/layout/painel.css` (estilo dos cartões de indicador do painel, que é a referência visual) e abra a referência `.claude/referencias/exemplo.png`.

## Arquivos que você pode editar (e só estes)

- `client/src/ui/estilo.css` (só **acrescentar** regras no fim e ajustar as regras de `.cartao-indicador-rotulo`, `.cartao-indicador-valor` e `.pagina-acoes`; não remova nada)
- `client/src/modules/financeiro/index.tsx`

## Passos

### 1. `estilo.css`: regras gerais (valem para todas as páginas internas)

- Espaçamento vertical entre os blocos de uma página: descubra em `Pagina` (em `ui/index.tsx`) qual é a classe do contêiner do conteúdo e faça os filhos diretos ficarem separados por `1rem` (`display: flex; flex-direction: column; gap: 1rem;` no contêiner, ou `> * + * { margin-top: 1rem; }`). Confira que isso não duplica margens já existentes em `.abas`, `.grade` e `.pagina-acoes` (zere a margem vertical própria desses blocos quando forem filhos diretos do contêiner).
- Cartão de indicador: `.cartao-indicador-rotulo` e `.cartao-indicador-valor` passam a ser `display: block`; o valor em 1.5rem, peso 800, cor `var(--cor-texto)`, uma linha, e o rótulo em 0.85rem, cor `var(--cor-texto-suave)`, com `margin-top: 2px`.
- Classes utilitárias novas:
  ```css
  .barra-ferramentas { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 0.75rem 1rem; }
  .barra-ferramentas > .filtros { flex: 1 1 320px; }
  .filtros { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 240px)); gap: 0.75rem; align-items: end; }
  .resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  .resumo-item { display: flex; align-items: center; gap: 14px; padding: 16px 18px; background: var(--cor-superficie); border: 1px solid var(--cor-borda); border-radius: var(--raio); box-shadow: var(--sombra); min-width: 0; }
  .resumo-icone { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0; }
  .resumo-icone-azul { background: var(--cor-azul-suave); color: var(--cor-primaria); }
  .resumo-icone-roxo { background: var(--cor-roxo-suave); color: var(--cor-roxo); }
  .resumo-icone-verde { background: var(--cor-verde-suave); color: var(--cor-verde); }
  .resumo-icone-laranja { background: var(--cor-laranja-suave); color: var(--cor-laranja); }
  .resumo-icone-vermelho { background: color-mix(in srgb, var(--cor-perigo) 14%, transparent); color: var(--cor-perigo); }
  .resumo-valor { display: block; font-size: 1.4rem; font-weight: 800; color: var(--cor-texto); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .resumo-rotulo { display: block; font-size: 0.85rem; color: var(--cor-texto-suave); }
  ```
  Dentro de `.filtros`, os campos não podem ter margem inferior própria (zere a margem do contêiner de campo quando estiver dentro de `.filtros`). Abaixo de 520 px, `.filtros` vira uma coluna (`grid-template-columns: 1fr`) e o botão de ação da `.barra-ferramentas` ocupa a largura toda.
- `.pagina-acoes`: `display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap;` sem margem vertical própria.

### 2. `financeiro/index.tsx`

- Resumo do administrativo: troque os quatro `<Cartao>` com `cartao-indicador-*` por uma `<div className="resumo">` com quatro `<div className="resumo-item">`, cada um com `<span className="resumo-icone resumo-icone-COR"><Icone nome="..." tamanho={24} /></span>` e um `<div>` com `<span className="resumo-valor">` e `<span className="resumo-rotulo">`: "Em aberto" (azul, ícone `financeiro`), "Atrasado" (vermelho, ícone `relogio`), "Recebido" (verde, ícone `grafico`), "Bolsas ativas" (roxo, ícone `alunos`). Importe `Icone` de `../../ui/icones`.
- Resumo do aluno (`/aluno/financeiro`): mesmo padrão, com o total em aberto.
- Aba Mensalidades: junte filtros e botão numa linha: `<div className="barra-ferramentas"><div className="filtros">[Selecao de status][Campo de competência]</div><Botao ...>Gerar mensalidades</Botao></div>`, no lugar do `<div className="pagina-acoes">` solto seguido dos filtros.
- Aba Bolsas: `<div className="barra-ferramentas"><div className="filtros"></div><Botao ...>Nova bolsa</Botao></div>` (sem filtros, o botão fica à direita).
- Não mude lógica, chamadas à API, textos nem tabelas.

### 3. Conferência nas outras páginas

Depois de acrescentar o espaçamento geral, leia rapidamente os `index.tsx` dos módulos `biblioteca`, `matricula`, `academico`, `diario`, `pos`, `agenda`, `comunicados` e `cadastros` procurando blocos que dependiam de margem própria e ficariam com espaço dobrado ou colados. Não edite esses arquivos: liste na sala, numa nota para o `@main`, qualquer página em que você enxergue um problema parecido com o do Financeiro (filtros empilhados em largura total, botão solto), com o nome do arquivo e a linha.

## Critérios de aceite

- No Financeiro: cartões de resumo com ícone, valor em cima e rótulo embaixo; espaço entre resumo, abas e conteúdo; filtros lado a lado à esquerda e botão à direita na mesma linha; em 360 px tudo em uma coluna, sem rolagem lateral.
- Nenhuma regra existente de `estilo.css` removida; nenhuma cor fixa nova.
- `cd client && npx tsc --noEmit` com zero erro.

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
