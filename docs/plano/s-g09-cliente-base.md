# Mini-plano g09: perfil TI, registro de telas e ícones novos no cliente

## Objetivo

Preparar a base do cliente para a segunda leva: o perfil TI (mesmo acesso do administrador), o aviso ao servidor a cada tela aberta (para o log de atividades) e os ícones e o grupo de menu das telas novas.

Leia antes: `docs/plano/segunda-leva.md` (seções "Decisões do main" e "Contrato do cliente": é o seu contrato), `client/src/lib/tipos.ts`, `client/src/lib/auth.tsx`, `client/src/lib/api.ts`, `client/src/App.tsx`, `client/src/ui/icones.tsx`, `client/src/layout/grupos.ts` e `client/src/layout/MenuUsuario.tsx`.

## Arquivos que você pode editar (e só estes)

- `client/src/lib/tipos.ts`
- `client/src/lib/auth.tsx`
- `client/src/App.tsx`
- `client/src/ui/icones.tsx`
- `client/src/layout/grupos.ts`
- `client/src/layout/MenuUsuario.tsx`

## Passos

1. **`tipos.ts`**: `export type PerfilReal = Perfil | 'TI';` e o campo `perfilReal: PerfilReal` em `UsuarioLogado`. O tipo `Perfil` continua com os quatro valores. Se existir uma lista ou função de rótulos de perfil neste arquivo, acrescente `TI` ("TI").
2. **`auth.tsx`**:
   - função `normalizarUsuario(bruto)`: recebe o usuário como veio da API ou do `localStorage` (em que `perfil` pode ser `TI`, e `perfilReal` pode não existir em sessões antigas) e devolve `{ ...bruto, perfilReal: bruto.perfilReal ?? bruto.perfil, perfil: (bruto.perfilReal ?? bruto.perfil) === 'TI' ? 'ADMIN' : bruto.perfil }`; cuide para que, se `bruto.perfil` já for `ADMIN` e `bruto.perfilReal` for `TI`, o resultado continue `perfil: 'ADMIN'`, `perfilReal: 'TI'`;
   - use-a ao entrar (resposta de `POST /auth/login`) e ao restaurar a sessão guardada; grave no `localStorage` o usuário já normalizado;
   - `sair()`: antes de limpar a sessão, dispare `api.post('/auth/sair').catch(() => undefined)` sem esperar a resposta.
3. **`App.tsx`**: um `useEffect` que, a cada mudança de `location.pathname` com usuário logado, encontra a rota correspondente (use `matchPath` do react-router-dom contra os `caminho` das rotas registradas) e dispara `api.post('/logs/tela', { caminho: location.pathname, titulo: rota.rotulo }).catch(() => undefined)`. Não registre a tela de login nem a página "não encontrada". Não bloqueie a navegação nem mostre erro.
4. **`icones.tsx`**: acrescente ao fim de `NomeIcone`, `NOMES_ICONES` e `DESENHOS`, no mesmo estilo preenchido dos demais:
   - `atividade`: linha de pulso (um traço que sobe e desce, como um eletrocardiograma) dentro de um quadrado arredondado sólido, com o traço recortado, ou um traço grosso de linha (este pode usar traço, como os ícones de linha);
   - `log`: folha ou painel sólido com três linhas recortadas e um marcador (ponto) à esquerda de cada linha;
   - `grade`: quatro quadrados arredondados sólidos em 2 x 2;
   - `lista`: três barras horizontais sólidas, cada uma com um ponto à esquerda;
   - `imagem`: moldura sólida com uma montanha e um sol recortados;
   - `pausar`: duas barras verticais sólidas;
   - `reproduzir`: triângulo sólido apontando para a direita.
5. **`grupos.ts`**: acrescente `{ titulo: 'Sistema', icones: ['atividade', 'log'] }` imediatamente antes do grupo "Conta".
6. **`MenuUsuario.tsx`**: o papel exibido passa a vir de `usuario.perfilReal` (mapa de rótulos com ADMIN "Administrador", TI "TI", SECRETARIA "Secretaria", PROFESSOR "Professor", ALUNO "Aluno").
7. Rode a verificação.

## Critérios de aceite

- Um usuário TI entra e cai no portal `/admin`, com o mesmo menu do administrador, e vê "TI" como papel.
- Sessões antigas guardadas no navegador (sem `perfilReal`) continuam funcionando.
- Cada troca de tela dispara um único `POST /logs/tela`; falha nessa chamada não aparece para o usuário.
- 41 ícones no total, sem cor fixa, com a mesma assinatura de `Icone`.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos (outros geradores trabalham ao mesmo tempo; se algum arquivo de outro gerador quebrar por causa do campo novo `perfilReal`, avise o `@main`).

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
