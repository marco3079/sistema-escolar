# Mini-plano g02: "Meu perfil" para o administrativo

## Objetivo

Hoje só professor e aluno têm a tela "Meu perfil" (onde se troca a senha). Como o sistema passa a nascer com um administrador de senha gerada, ADMIN e SECRETARIA também precisam dela.

Leia antes: `client/src/modules/cadastros/index.tsx`, `client/src/modules/cadastros/perfil.tsx` (componente `MeuPerfil`, que já serve para qualquer perfil: usa `GET /perfil/meu`, `PUT /perfil/meu` e `POST /auth/trocar-senha`), `client/src/layout/MenuUsuario.tsx` e `client/src/layout/grupos.ts`.

## Arquivos que você pode editar (e só estes)

- `client/src/modules/cadastros/index.tsx`
- `client/src/layout/MenuUsuario.tsx`
- `client/src/modules/cadastros/perfil.tsx` (só se o componente esconder algo indevidamente para ADMIN ou SECRETARIA)

## Passos

1. `cadastros/index.tsx`: acrescente a rota
   ```tsx
   {
     caminho: '/admin/perfil',
     rotulo: 'Meu perfil',
     icone: 'perfil',
     perfis: ['ADMIN', 'SECRETARIA'],
     elemento: <MeuPerfil />,
     ordem: 90,
   },
   ```
   (O grupo "Conta" de `grupos.ts` já recebe o ícone `perfil`, então o item aparece sozinho no menu.)
2. `MenuUsuario.tsx`: o item "Meu perfil" passa a aparecer para **todos** os perfis. Remova a condição `temPerfil` e calcule o caminho assim: PROFESSOR `/professor/perfil`, ALUNO `/aluno/perfil`, ADMIN e SECRETARIA `/admin/perfil`.
3. `perfil.tsx`: leia e confirme que para ADMIN e SECRETARIA a tela mostra nome, e-mail e perfil, permite editar o telefone e trocar a senha, e não quebra quando `aluno` e `professor` vêm `null`. O rótulo do perfil deve aparecer em português (ADMIN "Administrador", SECRETARIA "Secretaria"). Só edite se algo disso não estiver funcionando.
4. Rode a verificação.

## Critérios de aceite

- ADMIN e SECRETARIA têm "Meu perfil" no menu lateral (grupo Conta) e no menu do usuário, levando a `/admin/perfil`.
- Professor e aluno continuam como antes.
- `cd client && npx tsc --noEmit` com zero erro.

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
