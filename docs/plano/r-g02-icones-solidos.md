# Mini-plano g02: ícones em estilo preenchido

## Objetivo

Refazer o conjunto de ícones de `client/src/ui/icones.tsx` em estilo **preenchido (sólido)**, como no exemplo do usuário, e acrescentar 12 ícones novos.

Leia antes: `docs/plano/redesenho.md` (seção "Contrato de ícones"), abra a referência `.claude/referencias/exemplo.png` (Read) e observe os ícones da barra lateral e dos cartões, e leia o arquivo atual `client/src/ui/icones.tsx`.

## Arquivo que você pode editar (e só este)

- `client/src/ui/icones.tsx`

## Contrato

Mesma assinatura de hoje: `export type NomeIcone`, `export const NOMES_ICONES: NomeIcone[]`, `export function Icone({ nome, tamanho = 22, className })`.

`NomeIcone` passa a ter 34 nomes: os 22 atuais (`inicio`, `alunos`, `professores`, `usuarios`, `cursos`, `periodos`, `turmas`, `matriculas`, `diario`, `boletim`, `historico`, `pos`, `financeiro`, `biblioteca`, `horarios`, `calendario`, `comunicados`, `perfil`, `menu`, `mais`, `sair`, `fechar`) e mais 12: `busca`, `sino`, `seta-direita`, `seta-cima`, `seta-baixo`, `chevron-baixo`, `relogio`, `raio`, `grafico`, `engrenagem`, `documento`, `lapis`.

## Regras de desenho

- `<svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="currentColor" aria-hidden="true" focusable="false" className={className}>`. Sem `stroke` no `<svg>`.
- Estilo sólido: formas preenchidas com cantos arredondados. Detalhes internos (porta da casa, linhas de um documento, ponteiros do relógio) são **recortes**: use um único `<path>` com `fillRule="evenodd" clipRule="evenodd"`, em que a forma de dentro é um subcaminho, ou deixe um vão entre duas formas preenchidas.
- Exceção permitida: ícones de linha pura (`menu`, `fechar`, `seta-direita`, `seta-cima`, `seta-baixo`, `chevron-baixo`, `busca`) podem usar `fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"` no próprio elemento.
- Área de desenho de 2.5 a 21.5. No máximo 6 elementos por ícone. Nada de texto, cor fixa, `id`, `style` embutido ou biblioteca de ícones: os desenhos são seus.
- Mantenha a estrutura `const DESENHOS: Record<NomeIcone, React.ReactNode>`.

## O que cada ícone representa

Os 22 antigos mantêm o significado (veja a tabela em `docs/plano/g01-icones.md`), agora preenchidos. No exemplo: `inicio` é uma casa sólida; `alunos`, `professores` e `turmas` são silhuetas de pessoas (cabeça em círculo e ombros em meia-elipse); `boletim` são barras sólidas; `biblioteca` é um livro aberto sólido com a lombada recortada.

Para diferenciar as silhuetas: `alunos` = uma pessoa com um capelo pequeno sobre a cabeça; `professores` = uma pessoa com um retângulo (quadro) ao lado; `turmas` = três pessoas (uma maior ao centro, duas menores atrás); `usuarios` = chave; `perfil` = pessoa dentro de um círculo recortado.

Novos:

| Nome | Desenho |
|---|---|
| `busca` | Lupa: círculo e cabo na diagonal (linha). |
| `sino` | Sino sólido com o badalo embaixo. |
| `seta-direita` | Seta para a direita (linha com ponta). |
| `seta-cima` | Seta para cima (linha com ponta). |
| `seta-baixo` | Seta para baixo (linha com ponta). |
| `chevron-baixo` | "V" aberto para baixo (linha). |
| `relogio` | Círculo sólido com os dois ponteiros recortados. |
| `raio` | Raio sólido em zigue-zague. |
| `grafico` | Três barras sólidas crescentes com uma seta ou linha ascendente por cima. |
| `engrenagem` | Engrenagem sólida de oito dentes com o furo central recortado. |
| `documento` | Folha sólida com o canto dobrado e duas linhas recortadas. |
| `lapis` | Lápis sólido na diagonal, com a ponta para baixo à esquerda. |

## Passos

1. Entre na sala `sistema_escolar` como `g02` e publique o entendimento.
2. Reescreva o arquivo conforme o contrato e as regras.
3. Confira cada desenho: coordenadas dentro da área, paths com sintaxe válida, recortes com `evenodd`, nenhum ícone igual a outro.
4. Rode a verificação.

## Critérios de aceite

- 34 nomes em `NomeIcone`, em `NOMES_ICONES` (os 22 antigos primeiro, na ordem atual, depois os 12 novos na ordem acima) e em `DESENHOS`.
- Assinatura de `Icone` inalterada; nenhuma cor fixa.
- `cd client && npx tsc --noEmit` sem erro em `src/ui/icones.tsx`.

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install`. Outros geradores editam outros arquivos do cliente agora; erros fora de `src/ui/icones.tsx` não são seus.
