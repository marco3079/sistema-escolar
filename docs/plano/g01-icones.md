# Mini-plano g01: conjunto de ícones SVG

## Objetivo

Criar os ícones próprios do app como um componente React, para substituir os emojis do menu. Todos no mesmo traço, seguindo a cor do texto (tema claro e escuro).

Leia antes: `docs/plano/identidade-visual.md` (contrato) e `client/src/ui/index.tsx` (estilo de código do projeto).

## Arquivo que você pode criar (e só este)

- `client/src/ui/icones.tsx`

Não edite `client/src/ui/index.tsx`, `estilo.css`, `Layout.tsx` nem nenhum módulo: a integração é do g02.

## Contrato (exato)

```tsx
export type NomeIcone =
  | 'inicio' | 'alunos' | 'professores' | 'usuarios' | 'cursos' | 'periodos' | 'turmas'
  | 'matriculas' | 'diario' | 'boletim' | 'historico' | 'pos' | 'financeiro' | 'biblioteca'
  | 'horarios' | 'calendario' | 'comunicados' | 'perfil' | 'menu' | 'mais' | 'sair' | 'fechar';

export const NOMES_ICONES: NomeIcone[]; // os 22 nomes, na ordem acima

export function Icone(props: { nome: NomeIcone; tamanho?: number; className?: string }): JSX.Element;
```

## Regras de desenho (todos os ícones)

- `<svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>`; `tamanho` padrão 22.
- Estilo de contorno: só traço, sem preenchimento. Exceção: pontos pequenos (como os três pontos de `mais`) podem usar `fill="currentColor"` com `stroke="none"`.
- Desenhe dentro da área de 3 a 21 (margem de 3 unidades). Coordenadas inteiras ou com meio ponto (ex.: 4.5).
- Use formas simples: `path`, `rect` (com `rx`), `circle`, `line`, `polyline`. No máximo 6 elementos por ícone.
- Nada de texto, emoji, imagem externa, `id`, `style` embutido, cor fixa ou biblioteca de ícones. Os desenhos são seus, feitos com as formas acima.
- Estrutura do código: um objeto `const DESENHOS: Record<NomeIcone, React.ReactNode>` com o conteúdo de cada ícone, e o componente `Icone` monta o `<svg>` em volta. Assim o TypeScript acusa se faltar algum nome.

## O que cada ícone representa

| Nome | Desenho |
|---|---|
| `inicio` | Casa: telhado em "V" invertido e corpo com uma porta. |
| `alunos` | Capelo (chapéu de formatura): losango visto de cima com a base abaixo e a borla pendendo de um lado. |
| `professores` | Pessoa (círculo da cabeça e ombros) ao lado de um quadro (retângulo). |
| `usuarios` | Chave: argola (círculo) à esquerda e haste com dois dentes à direita. |
| `cursos` | Prédio escolar: fachada retangular com frontão triangular e porta central. |
| `periodos` | Calendário (retângulo com duas argolas no topo e a linha do cabeçalho) com um relógio pequeno no canto inferior direito, ou com um intervalo marcado por uma barra horizontal dentro. |
| `turmas` | Grupo: uma pessoa na frente (cabeça e ombros) e outra atrás, deslocada para a direita. |
| `matriculas` | Folha de papel com duas linhas de texto e um lápis na diagonal no canto inferior direito. |
| `diario` | Caderno fechado: retângulo com a lombada marcada por uma linha vertical à esquerda e duas linhas curtas na capa. |
| `boletim` | Gráfico de três barras verticais de alturas diferentes sobre uma linha de base. |
| `historico` | Documento com o canto superior direito dobrado e três linhas de texto. |
| `pos` | Frasco de laboratório (Erlenmeyer): gargalo estreito, corpo triangular e uma linha de nível dentro. |
| `financeiro` | Moeda: círculo com um cifrão simplificado (um "S" com um traço vertical) no centro. |
| `biblioteca` | Livro aberto visto de frente: duas páginas que se encontram numa lombada central. |
| `horarios` | Relógio: círculo com dois ponteiros (um para cima, um para a direita). |
| `calendario` | Calendário: retângulo com duas argolas no topo, linha do cabeçalho e quatro pontos ou quadradinhos de dias. |
| `comunicados` | Megafone: cone que abre para a direita, com o cabo embaixo. |
| `perfil` | Pessoa dentro de um círculo: círculo externo, cabeça e ombros dentro. |
| `menu` | Três linhas horizontais paralelas. |
| `mais` | Três pontos em linha horizontal (preenchidos). |
| `sair` | Porta (colchete aberto à esquerda) com uma seta apontando para a direita, saindo dela. |
| `fechar` | Um "X": duas linhas diagonais cruzadas. |

`periodos` e `calendario` precisam ser distinguíveis entre si. `turmas`, `professores` e `perfil` também.

## Passos

1. Entre na sala `sistema_escolar` como `g01` e publique o entendimento.
2. Escreva `client/src/ui/icones.tsx` conforme o contrato e as regras.
3. Confira cada desenho no papel: todas as coordenadas entre 3 e 21; nenhuma forma saindo da área; nenhum ícone igual a outro.
4. Rode a verificação.

## Critérios de aceite

- Os 22 nomes existem em `NomeIcone`, em `NOMES_ICONES` e em `DESENHOS`.
- `Icone` segue a assinatura do contrato e as regras de `<svg>` acima.
- Nenhuma cor fixa: tudo `currentColor`.
- `cd client && npx tsc --noEmit` sem erro em `src/ui/icones.tsx`.

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install`. O g02 está editando outros arquivos do cliente ao mesmo tempo; erros de `tsc` fora de `src/ui/icones.tsx` não são seus.
