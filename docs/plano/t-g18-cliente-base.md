# Mini-plano g18: base do cliente para a terceira leva

## Objetivo

Preparar as peças compartilhadas que as telas novas (perfil com medalhas, suporte, fórum, passe de layout) vão usar: ícones, avatar com foto, coluna de ações nas tabelas, menu do usuário com "Suporte" e o grupo "Comunidade" do menu.

Leia antes: `docs/plano/terceira-leva.md` (seção "Contrato do cliente": é o seu contrato), `client/src/ui/index.tsx`, `client/src/ui/estilo.css`, `client/src/ui/icones.tsx`, `client/src/lib/tipos.ts`, `client/src/lib/auth.tsx`, `client/src/layout/MenuUsuario.tsx`, `client/src/layout/grupos.ts`, `client/src/layout/casca.css` e `client/src/modules/cadastros/MenuAcoes.tsx` com `fichas.css` (o menu de ações que você vai reexportar).

## Arquivos que você pode editar (e só estes)

- `client/src/ui/icones.tsx`
- `client/src/ui/index.tsx`
- `client/src/ui/estilo.css` (só acrescentar no fim)
- `client/src/lib/tipos.ts`
- `client/src/lib/auth.tsx`
- `client/src/layout/MenuUsuario.tsx`
- `client/src/layout/casca.css` (só acrescentar no fim)
- `client/src/layout/grupos.ts`

## Passos

1. **Ícones** (`icones.tsx`): acrescente ao fim de `NomeIcone`, `NOMES_ICONES` e `DESENHOS`, no estilo preenchido dos demais, nesta ordem:
   - `medalha`: círculo sólido com uma estrela recortada e duas fitas embaixo;
   - `suporte`: balão de conversa sólido com um ponto de interrogação recortado;
   - `forum`: dois balões de conversa sobrepostos, sólidos;
   - `voto-cima`: seta larga para cima (triângulo com haste), sólida;
   - `voto-baixo`: a mesma seta apontando para baixo;
   - `comentario`: um balão de conversa sólido com três pontos recortados;
   - `anexo`: clipe de papel (linha; pode usar traço, como os ícones de linha);
   - `estrela`: estrela sólida de cinco pontas;
   - `enviar`: avião de papel sólido apontando para a direita;
   - `fixar`: alfinete sólido na diagonal;
   - `cadeado`: cadeado sólido com o furo da fechadura recortado.
   Assim que os 11 nomes estiverem gravados (mesmo com desenho provisório), publique na sala: "g18: os 11 ícones novos já estão em NomeIcone".
2. **`ui/index.tsx`**:
   - `ColunaTabela` ganha `alinhar?: 'esquerda' | 'direita' | 'centro'` e `acoes?: boolean`. Na tabela, aplique a classe de alinhamento na célula e no cabeçalho; coluna com `acoes` fica alinhada à direita, com largura mínima (`width: 1%; white-space: nowrap`), e o clique dentro dela não dispara `aoClicarLinha` (`stopPropagation` na célula). No modo cartão do celular, a célula de `acoes` aparece sem rótulo e sem dois-pontos, alinhada à direita, no fim do cartão.
   - Novo componente `Avatar({ nome, foto, tamanho = 40, className })`: redondo; com `foto`, `<img alt="" loading="lazy">` com `object-fit: cover` e, se a imagem falhar, cai para as iniciais; sem foto, as iniciais (primeira letra do primeiro e do último nome) sobre `var(--cor-primaria-suave)` com texto `var(--cor-primaria)`.
   - Reexporte o menu de ações: `export { MenuAcoes } from '../modules/cadastros/MenuAcoes'; export type { AcaoMenu } from '../modules/cadastros/MenuAcoes';`. Se isso criar importação circular (o `MenuAcoes` importa algo de `ui/index.tsx`), mova o arquivo para `client/src/ui/MenuAcoes.tsx` com o CSS dele para o fim de `estilo.css`, e deixe em `modules/cadastros/MenuAcoes.tsx` só uma reexportação; nesse caso avise o `@main` na sala.
3. **`estilo.css`** (no fim): classes de alinhamento da tabela, da célula de ações e do `Avatar`; e um componente utilitário de controle segmentado (`.segmentado` com botões `.segmentado-item` e `.segmentado-item[aria-pressed="true"]` em `var(--cor-primaria-suave)` e `var(--cor-primaria)`), para as telas que alternam visões.
4. **`tipos.ts`** e **`auth.tsx`**: `UsuarioLogado` ganha `foto: string | null`. `normalizarUsuario` preenche `foto: bruto.foto ?? null`. O contexto de autenticação ganha `atualizarFoto(foto: string | null)`, que atualiza o usuário em memória e no `localStorage`. Depois de entrar e ao restaurar a sessão, busque `GET /perfil/completo` uma vez em segundo plano e, se vier `usuario.foto`, chame `atualizarFoto` (falha silenciosa: o endpoint é de outro gerador e pode ainda não existir).
5. **`MenuUsuario.tsx`**:
   - use `<Avatar nome={usuario.nome} foto={usuario.foto} />` no lugar do círculo de iniciais;
   - o menu passa a ter três itens: "Meu perfil" (como hoje), "Suporte" (ícone `suporte`) e "Sair";
   - "Suporte" abre o popup de chamados: importe `PainelSuporte` de `../modules/suporte/PainelSuporte` com `React.lazy` e `Suspense` (o arquivo é de outro gerador, o g20, e vai existir com `export function PainelSuporte({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void })`); estado `suporteAberto`;
   - contador de novidades: `GET /chamados/novidades` ao montar e a cada 60 segundos (intervalo limpo no retorno; falha silenciosa); se `meus > 0`, mostre o número ao lado de "Suporte" e um ponto no avatar.
   Como `PainelSuporte` ainda não existe, o `tsc` vai acusar o import até o g20 entregar: registre isso no seu `done` (é esperado).
6. **`grupos.ts`**: acrescente `{ titulo: 'Comunidade', icones: ['forum', 'suporte'] }` imediatamente antes de "Sistema".
7. Rode a verificação.

## Critérios de aceite

- 52 ícones no total; nomes exatos; sem cor fixa.
- `Tabela` continua compatível com todos os usos atuais (as props novas são opcionais).
- `Avatar` e `MenuAcoes` exportados por `ui/index.tsx`.
- Menu do usuário com "Meu perfil", "Suporte" e "Sair"; contador de novidades sem laço nem intervalo sem limpeza.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos, fora o import de `PainelSuporte` enquanto o g20 não entregar.

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
