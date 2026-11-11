# Mini-plano g05: tela inicial (painel)

## Objetivo

Refazer a tela inicial dos três portais igual ao exemplo do usuário: saudação com data e hora sobre a ilustração do prédio, quatro cartões de indicador, gráfico "Desempenho Acadêmico", "Avisos Recentes", cartão de destaque ("Minha Turma") e "Atalhos Rápidos". Tudo com dados reais.

Leia antes: `docs/plano/redesenho.md` inteiro (principalmente "Como é o exemplo" e "Contrato de API"); abra a referência `.claude/referencias/exemplo.png` (Read) e observe toda a área à direita da barra lateral, nos dois temas; leia `client/src/layout/Painel.tsx` (versão atual, que você vai reescrever), `client/src/modules/inicio/index.tsx` (quem usa o `Painel`), `client/src/lib/api.ts`, `client/src/lib/useDados.ts`, `client/src/lib/auth.tsx`, `client/src/ui/index.tsx` e `client/src/ui/icones.tsx`.

## Arquivos que você pode criar ou editar (e só estes)

- `client/src/layout/Painel.tsx` (reescrever; continua exportando `Painel`)
- `client/src/layout/painel.css` (novo; importado por `Painel.tsx`)
- `client/src/layout/GraficoLinha.tsx` (novo)

## Regras gerais

- Classes novas começam com `painel-`. Cores, raios e sombras só pelas variáveis do contrato visual. Nenhuma cor fixa em `painel.css`, salvo `rgba` em sombras.
- Nenhuma biblioteca de gráfico: o gráfico é SVG feito à mão.
- Dados: `GET /painel/resumo` (formato no contrato; o g01 está implementando) e `GET /comunicados` (já existe; cada item tem `id`, `titulo`, `corpo`, `publicadoEm`, `lido`).

## Passos

1. **Cabeçalho** (`painel-cabecalho`): bloco com altura mínima de 150 px, `position: relative`, raio `var(--raio)`.
   - Fundo: a ilustração `/ilustracoes/predio-claro.png` no tema claro e `/ilustracoes/predio-escuro.png` no escuro (troque com `@media (prefers-color-scheme: dark)`), `background-position: right center; background-size: auto 100%; background-repeat: no-repeat`. Se a imagem não existir, fica só o fundo liso.
   - À esquerda: "Olá, {primeiroNome}!" (2rem, peso 800), abaixo "Aqui está um resumo do sistema escolar." (`var(--cor-texto-suave)`) e um traço de 44 x 4 px com `background: var(--gradiente-primario)` e raio 999px.
   - À direita: a data no formato "Seg, 29 de Set de 2025" com o ícone `calendario` (monte com arrays de dias e meses abreviados em português) e a hora "HH:MM" em 1.9rem peso 800. A hora atualiza a cada 30 segundos (`setInterval` limpo no retorno do `useEffect`).
   - No celular, data e hora vão para baixo do texto.
2. **Cartões de indicador** (`painel-indicadores`): grade de 4 colunas (2 abaixo de 1100 px, 1 abaixo de 520 px). Cada cartão (`var(--cor-superficie)`, borda, raio, sombra) tem: um quadrado de 52 px com raio 14 px e fundo suave da cor do cartão (`azul` usa `--cor-azul-suave` e ícone `--cor-primaria`; `roxo`, `verde` e `laranja` usam os pares `--cor-*-suave` e `--cor-*`), com o `<Icone nome={cartao.icone} tamanho={26} />` na cor forte; o `valor` em 1.6rem peso 800; o `rotulo` em 0.85rem suave; e, se `variacao !== null`, à direita embaixo, uma seta (`seta-cima` se >= 0, `seta-baixo` se < 0) com o número formatado com vírgula, sinal e "%" ("+2,5%"), em `var(--cor-sucesso)` ou `var(--cor-perigo)`.
3. **Linha inferior** (`painel-linha`): grade de 3 colunas com proporção 1.5fr 1fr 1fr a partir de 1100 px; abaixo disso, 1 coluna.
4. **Cartão "Desempenho Acadêmico"**: cabeçalho com o ícone `boletim` em `var(--cor-primaria)`, o título (peso 700) e, à direita, um `<select>` em pílula com "Últimos 3 meses", "Últimos 6 meses" (padrão) e "Últimos 12 meses", que corta os últimos N itens de `desempenho`. Corpo: `<GraficoLinha pontos={...} />`. Se todos os valores forem `null`, mostre "Ainda não há notas lançadas neste período." em texto suave.
5. `GraficoLinha.tsx`: `export function GraficoLinha({ pontos }: { pontos: { rotulo: string; valor: number | null }[] })`.
   - `<svg viewBox="0 0 600 240" width="100%" role="img" aria-label="Gráfico de desempenho">`, com `preserveAspectRatio="xMidYMid meet"`.
   - Área do gráfico: x de 48 a 588, y de 16 (100%) a 196 (0%). Linhas de grade horizontais em 0, 25, 50, 75 e 100% (`stroke="var(--cor-borda)"`), com os rótulos "0%" a "100%" à esquerda (`fill="var(--cor-texto-suave)"`, 12 px). Rótulos dos meses embaixo (y = 222), centralizados em cada ponto.
   - x de cada ponto: distribuído por igual; com um ponto só, no centro.
   - Linha: `<path>` ligando os pontos com valor (pule os `null`; se houver buraco, a linha segue para o próximo ponto com valor), `stroke="var(--cor-primaria)"`, largura 3, cantos redondos, sem preenchimento.
   - Área sob a linha: mesmo caminho fechado até y = 196, com `fill="url(#painel-degrade)"`; o `<linearGradient id="painel-degrade">` vai de `var(--cor-primaria)` com opacidade 0.28 no topo até opacidade 0 embaixo (use `stopColor="var(--cor-primaria)"` e `stopOpacity`).
   - Em cada ponto com valor: `<circle r="5" fill="var(--cor-superficie)" stroke="var(--cor-primaria)" strokeWidth="3">` com um `<title>` "{rotulo}: {valor}%".
   - Balão no último ponto com valor: retângulo arredondado (`fill="var(--cor-texto)"`) com o texto "{valor}%" formatado com vírgula (`fill="var(--cor-superficie)"`, 13 px, peso 700), acima do ponto; se o ponto estiver perto da borda direita, alinhe o balão para a esquerda de modo que não saia do `viewBox`.
6. **Cartão "Avisos Recentes"**: cabeçalho com o ícone `comunicados`, o título e o link "Ver todos" com `seta-direita` para a tela de comunicados do portal (`/admin/comunicados`, `/professor/comunicados`, `/aluno/comunicados`, conforme o perfil de `useAuth`). Corpo: os 3 comunicados mais recentes; cada um com uma bolinha de 12 px dentro de um círculo suave (cores alternando azul, roxo, verde pela posição), título em peso 700, o começo do `corpo` (uma linha, reticências) e, à direita, o tempo relativo ("agora", "há 5 min", "há 1h", "há 3 dias", calculado de `publicadoEm`). Sem comunicados: "Nenhum aviso por enquanto."
7. **Coluna da direita** (dois cartões empilhados):
   - **Destaque**: se `destaque` não for `null`, cartão com fundo `var(--cor-primaria-suave)`, a ilustração `/ilustracoes/livros-claro.png` (escuro: `livros-escuro.png`) como fundo à direita (`background-size: auto 100%; background-position: right center`), o ícone `turmas` e a `etiqueta` (peso 700), o `titulo` em 1.25rem peso 800, o `subtitulo` suave e um `Link` em pílula "Ver detalhes" com `seta-direita` para `destaque.caminho`. Se for `null`, não renderize o cartão.
   - **Atalhos Rápidos**: título com o ícone `raio`; grade de 4 botões quadrados (2 colunas abaixo de 520 px), cada um um `Link` com borda, raio `var(--raio-pequeno)`, ícone em `var(--cor-primaria)` e rótulo de 0.72rem em até duas linhas. Atalhos por perfil:
     - ADMIN e SECRETARIA: "Nova matrícula" (`matriculas`, `/admin/matriculas`), "Consultar alunos" (`alunos`, `/admin/alunos`), "Emitir boletins" (`documento`, `/admin/boletins`), "Configurar turmas" (`engrenagem`, `/admin/turmas`).
     - PROFESSOR: "Registrar notas" (`lapis`, `/professor/turmas`), "Meu horário" (`horarios`, `/professor/horario`), "Orientações" (`pos`, `/professor/orientacoes`), "Comunicados" (`comunicados`, `/professor/comunicados`).
     - ALUNO: "Meu boletim" (`boletim`, `/aluno/boletim`), "Meu horário" (`horarios`, `/aluno/horario`), "Financeiro" (`financeiro`, `/aluno/financeiro`), "Biblioteca" (`biblioteca`, `/aluno/biblioteca`).
8. Estados: enquanto `/painel/resumo` carrega, mostre `<Carregando />` no lugar dos indicadores e do gráfico; em erro, `<Aviso tipo="erro">`. O cabeçalho e os atalhos aparecem mesmo assim (use o primeiro nome de `useAuth().usuario.nome` até a resposta chegar).
9. Espere o `done` do g02 (ícones) na sala antes da verificação final, porque você usa nomes novos (`seta-cima`, `seta-baixo`, `seta-direita`, `raio`, `documento`, `engrenagem`, `lapis`).

## Critérios de aceite

- A tela inicial dos três portais segue a estrutura do exemplo: cabeçalho, 4 indicadores, linha com gráfico, avisos e coluna de destaque + atalhos.
- Nenhum número inventado: tudo vem de `/painel/resumo` e `/comunicados`.
- Gráfico em SVG sem biblioteca, legível nos dois temas, sem nada fora do `viewBox`.
- Em 360 px tudo fica em uma coluna, sem rolagem horizontal.
- Nenhuma cor fixa em `painel.css` (salvo `rgba` de sombras).
- `cd client && npx tsc --noEmit` com zero erro em `src/layout/` e `npx vite build` sem erro (apague `client/dist`).

## Verificação

```
cd client
npx tsc --noEmit
npx vite build
```

Não rode `npm install`, não suba Docker nem servidor.
