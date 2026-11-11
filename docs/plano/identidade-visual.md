# Plano da identidade visual: logo e ícones

## Pedido

"Cria uma logo e ícones personalizados."

## Decisões do usuário (popup de 10/11/2026)

- Logo feita no Canva pelo artista; ícones em SVG.
- Nome na logo: **Sistema Escolar**.
- Estilo: moderno e limpo. Símbolos: **lápis** e **livro aberto**.
- Cor principal: o azul atual do app, `#1d4ed8`.
- Onde entra: menu dos três portais, tela de login e topo do app, ícone do app no celular e aba do navegador, README do GitHub.
- Referência enviada: painel escolar com barra lateral, ícones monocromáticos de um só estilo, cartões arredondados, temas claro e escuro.

## Contrato entre as três partes

### Arquivos da logo (feitos pelo artista `arte`)

| Arquivo | Tamanho | Conteúdo | Usado em |
|---|---|---|---|
| `assets/artes/logo_simbolo.png` | 512 x 512 px | Quadrado de cantos arredondados em azul `#1d4ed8` ocupando a imagem toda, com o símbolo (livro aberto + lápis) em branco no centro. Sem texto. | original |
| `client/public/logo-simbolo.png` | cópia idêntica do arquivo acima | | login, topo do app, favicon, ícone do PWA |
| `assets/artes/logo.png` | cerca de 1200 x 400 px | Símbolo à esquerda e o texto "Sistema Escolar" à direita. Fundo branco. | README |

O app usa só o símbolo e escreve o nome "Sistema Escolar" em HTML, para o texto acompanhar o tema claro/escuro.

### Componente de ícones (feito pelo gerador `g01`)

Arquivo `client/src/ui/icones.tsx`:

```tsx
export type NomeIcone =
  | 'inicio' | 'alunos' | 'professores' | 'usuarios' | 'cursos' | 'periodos' | 'turmas'
  | 'matriculas' | 'diario' | 'boletim' | 'historico' | 'pos' | 'financeiro' | 'biblioteca'
  | 'horarios' | 'calendario' | 'comunicados' | 'perfil' | 'menu' | 'mais' | 'sair' | 'fechar';

export const NOMES_ICONES: NomeIcone[];

export function Icone(props: { nome: NomeIcone; tamanho?: number; className?: string }): JSX.Element;
// tamanho padrão 22 (px). Renderiza <svg viewBox="0 0 24 24"> com a cor do texto (currentColor).
```

### Troca dos emojis (feita pelo gerador `g02`)

| Emoji atual | Nome novo | Onde |
|---|---|---|
| 🏠 | `inicio` | `modules/inicio/index.tsx` |
| 🎓 | `alunos` | `modules/cadastros/index.tsx` |
| 👩‍🏫 | `professores` | `modules/cadastros/index.tsx` |
| 🔑 | `usuarios` | `modules/cadastros/index.tsx` |
| 👤 | `perfil` | `modules/cadastros/index.tsx` |
| 🏫 | `cursos` | `modules/academico/index.tsx` |
| 🗓️ | `periodos` | `modules/academico/index.tsx` |
| 👥 | `turmas` | `modules/academico/index.tsx` |
| 📝 | `matriculas` | `modules/matricula/index.tsx` e `modules/matricula/aluno.tsx` |
| 📒 | `diario` | `modules/diario/index.tsx` |
| 📊 | `boletim` | `modules/diario/index.tsx` |
| 📜 | `historico` | `modules/diario/index.tsx` |
| 🔬 | `pos` | `modules/pos/index.tsx` |
| 💰 | `financeiro` | `modules/financeiro/index.tsx` |
| 📚 | `biblioteca` | `modules/biblioteca/index.tsx` |
| 🕒 | `horarios` | `modules/agenda/index.tsx` |
| 📅 | `calendario` | `modules/agenda/index.tsx` |
| 📣 | `comunicados` | `modules/comunicados/index.tsx` |

## Partes

| Agente | Mini-plano | Entrega |
|---|---|---|
| `arte` | [arte-logo.md](arte-logo.md) | Logo no Canva, exportada em PNG |
| `g01` | [g01-icones.md](g01-icones.md) | Conjunto de 22 ícones SVG |
| `g02` | [g02-integracao-visual.md](g02-integracao-visual.md) | Ícones no menu, logo no login e no topo, favicon, PWA e README |

Depois: revisor em cada entrega; o main reconstrói a imagem no Docker, confere as telas em celular e desktop, e envia ao GitHub.

## Andamento

| Parte | Estado |
|---|---|
| Mini-planos | feito |
| Logo (`arte`) | aprovada (cantos tornados transparentes pelo main) |
| Ícones (`g01`) | aprovada |
| Integração (`g02`) | aprovada |
| Teste e envio | testado no Docker; commit local feito |
